import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioTranscribeUrl } from "@/shared/utils/hudApi";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";

interface UseMicCaptureOptions {
  onChunk: (text: string) => void;
                                                                                                                    
  onVoiceBackendError?: () => void;
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

function getSupportedMimeType(): string {
  for (const type of SUPPORTED_MIME_TYPES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "audio/webm";
}

export function useMicCapture({
  onChunk,
  onVoiceBackendError,
  accessToken,
  refreshAccessToken,
  lang = "en-US",
  chunkIntervalMs = 3000,
}: UseMicCaptureOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string>();
  const [isSupported] = useState(
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined",
  );

  const onChunkRef = useRef(onChunk);
  useEffect(() => { onChunkRef.current = onChunk; });

  const onVoiceBackendErrorRef = useRef(onVoiceBackendError);
  useEffect(() => {
    onVoiceBackendErrorRef.current = onVoiceBackendError;
  });

  const accessTokenRef = useRef<string | null>(accessToken ?? null);
  useEffect(() => { accessTokenRef.current = accessToken ?? null; });

  const refreshAccessTokenRef = useRef(refreshAccessToken);
  useEffect(() => { refreshAccessTokenRef.current = refreshAccessToken; });

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const activeRequestsRef = useRef<Set<AbortController>>(new Set());
                                                                                                                 
  const captureSessionRef = useRef(0);

  const stop = useCallback(() => {
    captureSessionRef.current += 1;
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
      setError("Microphone not supported in this browser");
      return;
    }

    const sessionBeforeMedia = captureSessionRef.current; 

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
        video: false,
      });

      if (sessionBeforeMedia !== captureSessionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      captureSessionRef.current += 1;
      const chunkSession = captureSessionRef.current;

      recorder.ondataavailable = async (event) => {
        if (event.data.size < 100) return;

        const controller = new AbortController();
        activeRequestsRef.current.add(controller);

        const transcribeUrl = `${getAudioTranscribeUrl()}?lang=${encodeURIComponent(lang)}`;
        try {
          const res = await fetchWithAuth(
            transcribeUrl,
            {
              method: "POST",
              headers: { "Content-Type": event.data.type || mimeType },
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
            onVoiceBackendErrorRef.current?.();
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          if (chunkSession !== captureSessionRef.current) return;
          stop();
          onVoiceBackendErrorRef.current?.();
        } finally {
          activeRequestsRef.current.delete(controller);
        }
      };

      recorder.onerror = () => {
        if (chunkSession !== captureSessionRef.current) return;
        setError("MediaRecorder error");
        stop();
        onVoiceBackendErrorRef.current?.();
      };

      recorder.onstop = () => {
        setIsListening(false);
      };

      recorder.start(chunkIntervalMs);
      setIsListening(true);
      setError(undefined);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : err instanceof Error
          ? err.message
          : "Failed to access microphone";
      setError(message);
      setIsListening(false);
    }
  }, [isSupported, lang, chunkIntervalMs, stop]);

  useEffect(() => () => {
    captureSessionRef.current += 1;
    for (const controller of activeRequestsRef.current) {
      controller.abort();
    }
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { isListening, isSupported, error, start, stop };
}
