import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioTranscribeUrl } from "@/shared/utils/hudApi";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";

interface UseSystemAudioCaptureOptions {
  onChunk: (text: string) => void;
  sendAudioChunk?: (audio: Blob, mimeType: string) => Promise<boolean>;
  onError?: () => void;
  accessToken?: string | null;
  refreshAccessToken?: () => Promise<string | null>;
  lang?: string;
  chunkIntervalMs?: number;
}

const SUPPORTED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

const FETCH_TIMEOUT_MS = 30_000;
// Silence heuristic: Opus compresses real speech to >> this per second.
// Very quiet / paused audio produces tiny blobs we can safely skip.
const SILENCE_BYTES_PER_SEC = 600;

function getSupportedMimeType(): string {
  for (const type of SUPPORTED_MIME_TYPES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "audio/webm";
}

export function useSystemAudioCapture({
  onChunk,
  sendAudioChunk,
  onError,
  accessToken,
  refreshAccessToken,
  lang = "en-US",
  chunkIntervalMs = 3000,
}: UseSystemAudioCaptureOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string>();
  const [isSupported] = useState(
    () =>
      typeof navigator !== "undefined" &&
      typeof (navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown })?.getDisplayMedia === "function" &&
      typeof MediaRecorder !== "undefined",
  );

  const onChunkRef = useRef(onChunk);
  useEffect(() => { onChunkRef.current = onChunk; });

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  const sendAudioChunkRef = useRef(sendAudioChunk);
  useEffect(() => { sendAudioChunkRef.current = sendAudioChunk; });

  const accessTokenRef = useRef<string | null>(accessToken ?? null);
  useEffect(() => { accessTokenRef.current = accessToken ?? null; });

  const refreshAccessTokenRef = useRef(refreshAccessToken);
  useEffect(() => { refreshAccessTokenRef.current = refreshAccessToken; });

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cycleTimerRef = useRef<number | null>(null);
  const activeRequestsRef = useRef<Set<AbortController>>(new Set());
  const captureSessionRef = useRef(0);

  const stop = useCallback(() => {
    captureSessionRef.current += 1;
    if (cycleTimerRef.current !== null) {
      window.clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    for (const controller of activeRequestsRef.current) {
      controller.abort();
    }
    activeRequestsRef.current.clear();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("System audio capture not supported in this browser");
      return;
    }

    const sessionBeforeMedia = captureSessionRef.current;

    try {
      const gdm = (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (constraints: Record<string, unknown>) => Promise<MediaStream>;
      }).getDisplayMedia;

      const stream = await gdm.call(navigator.mediaDevices, {
        audio: true,
        video: { displaySurface: "monitor" },
        systemAudio: "include",
      });

      if (sessionBeforeMedia !== captureSessionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setError("No audio track — tick 'Share system audio' at the bottom of the Chrome picker before clicking Share");
        return;
      }

      // Drop any video tracks the browser may have included by default
      stream.getVideoTracks().forEach((t) => t.stop());

      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const audioOnly = new MediaStream(audioTracks);

      captureSessionRef.current += 1;
      const chunkSession = captureSessionRef.current;

      // Each cycle creates a fresh MediaRecorder so every blob has its own EBML
      // header and is self-contained — timeslice mode only puts headers in the
      // first chunk, making all subsequent chunks unreadable by ffmpeg.
      const startCycle = () => {
        if (chunkSession !== captureSessionRef.current) return;

        const cycleRecorder = new MediaRecorder(audioOnly, { mimeType });
        recorderRef.current = cycleRecorder;

        cycleRecorder.ondataavailable = async (event) => {
          const silenceThreshold = SILENCE_BYTES_PER_SEC * (chunkIntervalMs / 1000);
          if (event.data.size < silenceThreshold) return;
          if (chunkSession !== captureSessionRef.current) return;

          const chunkMime = event.data.type || mimeType;
          console.log("[system-audio] chunk captured", { sizeBytes: event.data.size, mimeType: chunkMime });

          const wsSend = sendAudioChunkRef.current;
          if (wsSend) {
            try {
              const sent = await wsSend(event.data, chunkMime);
              if (sent) {
                console.log("[system-audio] chunk sent via WS", { sizeBytes: event.data.size });
                return;
              }
            } catch {
              // fall through to HTTP
            }
          }

          // HTTP fallback path
          const controller = new AbortController();
          activeRequestsRef.current.add(controller);

          const transcribeUrl = `${getAudioTranscribeUrl()}?lang=${encodeURIComponent(lang)}`;
          try {
            const res = await fetchWithAuth(
              transcribeUrl,
              {
                method: "POST",
                headers: { "Content-Type": chunkMime },
                body: event.data,
                signal: AbortSignal.any([
                  controller.signal,
                  AbortSignal.timeout(FETCH_TIMEOUT_MS),
                ]),
              },
              () => accessTokenRef.current,
              async () => {
                const refresh = refreshAccessTokenRef.current;
                return refresh ? refresh() : null;
              },
            );

            if (chunkSession !== captureSessionRef.current) return;

            if (res.ok) {
              const json = await res.json() as { data?: { text: string }; success: boolean };
              if (chunkSession !== captureSessionRef.current) return;
              const text = json.data?.text?.trim();
              if (text) onChunkRef.current(text);
            } else {
              stop();
              onErrorRef.current?.();
            }
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            if (chunkSession !== captureSessionRef.current) return;
            stop();
            onErrorRef.current?.();
          } finally {
            activeRequestsRef.current.delete(controller);
          }
        };

        cycleRecorder.onerror = () => {
          if (chunkSession !== captureSessionRef.current) return;
          setError("MediaRecorder error during system audio capture");
          stop();
          onErrorRef.current?.();
        };

        cycleRecorder.onstop = () => {
          if (chunkSession !== captureSessionRef.current) {
            setIsListening(false);
            return;
          }
          startCycle();
        };

        cycleRecorder.start(); // no timeslice — complete blob with headers on every stop
        cycleTimerRef.current = window.setTimeout(() => {
          cycleTimerRef.current = null;
          if (cycleRecorder.state === "recording") cycleRecorder.stop();
        }, chunkIntervalMs);
      };

      // Stop when the user clicks "Stop sharing" in Chrome's share bar.
      // addEventListener is more reliable than onended (can't be overwritten)
      // and we listen on every track so any track ending triggers cleanup.
      const handleTrackEnded = () => {
        if (chunkSession === captureSessionRef.current) stop();
      };
      audioTracks.forEach((t) => t.addEventListener("ended", handleTrackEnded));

      startCycle();
      setIsListening(true);
      setError(undefined);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Screen-share permission denied"
          : err instanceof Error
          ? err.message
          : "Failed to capture system audio";
      setError(message);
      setIsListening(false);
    }
  }, [isSupported, lang, chunkIntervalMs, stop]);

  useEffect(() => () => {
    captureSessionRef.current += 1;
    if (cycleTimerRef.current !== null) {
      window.clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    for (const controller of activeRequestsRef.current) {
      controller.abort();
    }
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { isListening, isSupported, error, start, stop };
}
