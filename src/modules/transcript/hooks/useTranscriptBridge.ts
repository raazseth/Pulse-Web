import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type {
  TranscriptChunkInput,
  TranscriptItem,
  TranscriptSignalCue,
  TranscriptSocketPrompt,
  TranscriptStreamStatus,
} from "@/modules/transcript/types";

const CHANNEL = "pulse-transcript-bridge-v1";

type ToMain = { type: "send-chunk"; payload: TranscriptChunkInput };
type ToPip = {
  type: "state";
  items: TranscriptItem[];
  prompts: TranscriptSocketPrompt[];
  signals: TranscriptSignalCue[];
  status: TranscriptStreamStatus;
};

// Called in the main window: broadcasts state to pip, relays chunk requests back.
export function useTranscriptMainBridge(
  enabled: boolean,
  items: TranscriptItem[],
  prompts: TranscriptSocketPrompt[],
  signals: TranscriptSignalCue[],
  status: TranscriptStreamStatus,
  sendChunk: (payload: TranscriptChunkInput) => boolean,
) {
  const sendRef = useRef(sendChunk);
  useEffect(() => { sendRef.current = sendChunk; });

  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ch = new BroadcastChannel(CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<ToMain>) => {
      if (e.data?.type === "send-chunk") sendRef.current(e.data.payload);
    };
    return () => { ch.close(); channelRef.current = null; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    channelRef.current?.postMessage({ type: "state", items, prompts, signals, status } satisfies ToPip);
  }, [enabled, items, prompts, signals, status]);
}

// Called in the pip window: receives state from main, relays sends back.
export function useTranscriptPipBridge(enabled: boolean) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [prompts, setPrompts] = useState<TranscriptSocketPrompt[]>([]);
  const [signals, setSignals] = useState<TranscriptSignalCue[]>([]);
  const [status, setStatus] = useState<TranscriptStreamStatus>("connecting");
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ch = new BroadcastChannel(CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<ToPip>) => {
      if (e.data?.type !== "state") return;
      startTransition(() => {
        setItems(e.data.items ?? []);
        setPrompts(e.data.prompts ?? []);
        setSignals(e.data.signals ?? []);
        setStatus(e.data.status ?? "connecting");
      });
    };
    return () => { ch.close(); channelRef.current = null; };
  }, [enabled]);

  const sendChunk = useCallback((payload: TranscriptChunkInput): boolean => {
    const ch = channelRef.current;
    if (!ch) return false;
    ch.postMessage({ type: "send-chunk", payload } satisfies ToMain);
    return true;
  }, []);

  return { items, prompts, signals, status, sendChunk };
}
