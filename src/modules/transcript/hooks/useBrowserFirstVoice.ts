import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { useMicCapture } from "@/modules/transcript/hooks/useMicCapture";
import {
  getSpeechRecognitionConstructor,
  isBrowserSpeechRecognitionSupported,
  type BrowserSpeechRecognition,
  type BrowserSpeechRecognitionErrorEvent,
} from "@/modules/transcript/utils/browserSpeechRecognition";

export interface BrowserFirstVoiceControls {
  speechListening: boolean;
  isActive: boolean;
  supported: boolean;
  toggle: () => void;
}

export function useBrowserFirstVoice(opts: {
  mic: ReturnType<typeof useMicCapture>;
  onDictatedText?: (text: string) => void;
  disabled: boolean;
  getSpeakerId: () => string;
  transcribeFallbackRef?: MutableRefObject<(() => void) | null>;
}): BrowserFirstVoiceControls {
  const { mic, onDictatedText, disabled, getSpeakerId, transcribeFallbackRef } = opts;
  const [speechListening, setSpeechListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const onDictatedTextRef = useRef(onDictatedText);
  const micRef = useRef(mic);
  const getSpeakerIdRef = useRef(getSpeakerId);
  useEffect(() => {
    onDictatedTextRef.current = onDictatedText;
  }, [onDictatedText]);
  useEffect(() => {
    micRef.current = mic;
  }, [mic]);
  useEffect(() => {
    getSpeakerIdRef.current = getSpeakerId;
  }, [getSpeakerId]);

  const stopBrowserSpeech = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
                           
    }
    recognitionRef.current = null;
    setSpeechListening(false);
  }, []);

  const startBrowserSpeech = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    const send = onDictatedTextRef.current;
    if (!Ctor || disabled || !send) return;
    if (recognitionRef.current) return;
    if (micRef.current.isListening) {
      micRef.current.stop();
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        }
      }
      const chunk = finalText.trim();
      if (chunk) {
        const speakerId = getSpeakerIdRef.current().trim() || "interviewer";
        console.log("[browser-transcript]", { text: chunk, speakerId });
        send(chunk);
      }
    };

    rec.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      stopBrowserSpeech();
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setSpeechListening(false);
    };

    try {
      rec.start();
      setSpeechListening(true);
    } catch {
      recognitionRef.current = null;
      setSpeechListening(false);
    }
  }, [disabled, stopBrowserSpeech]);

  useEffect(() => () => stopBrowserSpeech(), [stopBrowserSpeech]);

  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (disabled && !prevDisabledRef.current) {
      stopBrowserSpeech();
      mic.stop();
    }
    prevDisabledRef.current = disabled;
  }, [disabled, mic, stopBrowserSpeech]);

  const runServerTranscribeFallback = useCallback(() => {
    if (!onDictatedTextRef.current || !getSpeechRecognitionConstructor()) return;
    startBrowserSpeech();
  }, [startBrowserSpeech]);

  useEffect(() => {
    if (!transcribeFallbackRef) return;
    transcribeFallbackRef.current = runServerTranscribeFallback;
    return () => {
      transcribeFallbackRef.current = null;
    };
  }, [transcribeFallbackRef, runServerTranscribeFallback]);

  const voiceSupported =
    isBrowserSpeechRecognitionSupported() || mic.isSupported;
  const isVoiceActive = speechListening || mic.isListening;

  const toggleVoice = useCallback(() => {
    if (disabled) return;
    if (speechListening) {
      stopBrowserSpeech();
      return;
    }
    if (mic.isListening) {
      mic.stop();
      return;
    }
    if (isBrowserSpeechRecognitionSupported() && onDictatedText) {
      startBrowserSpeech();
      return;
    }
    if (mic.isSupported) {
      mic.start();
    }
  }, [
    disabled,
    mic,
    onDictatedText,
    speechListening,
    startBrowserSpeech,
    stopBrowserSpeech,
  ]);

  return useMemo(
    () => ({
      speechListening,
      isActive: isVoiceActive,
      supported: voiceSupported,
      toggle: toggleVoice,
    }),
    [speechListening, isVoiceActive, voiceSupported, toggleVoice],
  );
}
