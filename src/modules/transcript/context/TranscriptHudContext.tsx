import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TranscriptStreamStatus } from "@/modules/transcript/types";

type TranscriptHudContextValue = {
  hudSocketStatus: TranscriptStreamStatus;
  setHudSocketStatus: (status: TranscriptStreamStatus) => void;
  hudSocketError?: string;
  setHudSocketError: (message?: string) => void;
};

const TranscriptHudContext = createContext<TranscriptHudContextValue | null>(null);

export function TranscriptHudProvider({ children }: { children: ReactNode }) {
  const [hudSocketStatus, setHudSocketStatus] = useState<TranscriptStreamStatus>("disconnected");
  const [hudSocketError, setHudSocketError] = useState<string | undefined>();
  const value = useMemo(
    () => ({ hudSocketStatus, setHudSocketStatus, hudSocketError, setHudSocketError }),
    [hudSocketStatus, hudSocketError],
  );
  return (
    <TranscriptHudContext.Provider value={value}>
      {children}
    </TranscriptHudContext.Provider>
  );
}

export function useTranscriptHud() {
  const ctx = useContext(TranscriptHudContext);
  if (!ctx) {
    throw new Error("useTranscriptHud must be used within TranscriptHudProvider");
  }
  return ctx;
}
