import { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { createPortal } from "react-dom";
import Draggable, { DraggableData, DraggableEvent } from "react-draggable";
import { OverlayChunkDialog } from "@/modules/transcript/components/OverlayChunkDialog";

const INACTIVITY_MS = 3000;
const SNAP_THRESHOLD = 80;
const SNAP_PAD = 12;
const PANEL_WIDTH = 188;

const IconMicOn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
);

const IconMicOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

const IconSendChunk = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

type BtnVariant = "teal" | "red" | "violet" | "ghost";

const VARIANTS: Record<BtnVariant, { bg: string; bgH: string; color: string; colorH: string; ring: string }> = {
  teal: { bg: "rgba(20,159,119,0.18)", bgH: "rgba(20,159,119,0.32)", color: "#34d399", colorH: "#fff", ring: "rgba(20,159,119,0.6)" },
  red: { bg: "rgba(239,68,68,0.18)", bgH: "rgba(239,68,68,0.32)", color: "#f87171", colorH: "#fff", ring: "rgba(239,68,68,0.6)" },
  violet: { bg: "rgba(139,92,246,0.18)", bgH: "rgba(139,92,246,0.32)", color: "#c4b5fd", colorH: "#fff", ring: "rgba(139,92,246,0.6)" },
  ghost: { bg: "rgba(255,255,255,0.07)", bgH: "rgba(239,68,68,0.20)", color: "rgba(255,255,255,0.38)", colorH: "#fca5a5", ring: "rgba(255,255,255,0.4)" },
};

function OvBtn({ children, onClick, ariaLabel, variant = "ghost", size = 40, active = false, disabled = false }: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  variant?: BtnVariant;
  size?: number;
  active?: boolean;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const v = VARIANTS[variant];
  const dim = disabled;

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: dim ? "rgba(255,255,255,0.04)" : (hovered || active) ? v.bgH : v.bg,
    border: `2px solid ${dim ? "transparent" : (focused || active) ? v.ring : "transparent"}`,
    outline: "none",
    cursor: dim ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: dim ? "rgba(255,255,255,0.22)" : (hovered || active) ? v.colorH : v.color,
    flexShrink: 0,
    transition: "background 150ms ease, color 150ms ease, transform 150ms ease, border-color 150ms ease",
    transform: dim || !hovered ? "scale(1)" : "scale(1.12)",
    opacity: dim ? 0.55 : 1,
    pointerEvents: dim ? "none" : "auto",
  };

  return (
    <button
      type="button"
      style={style}
      onClick={() => { if (!dim) onClick(); }}
      aria-label={ariaLabel}
      aria-disabled={dim}
      disabled={dim}
      onMouseEnter={() => !dim && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => !dim && setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </button>
  );
}

interface SessionOverlayProps {
  onClose?: () => void;
  /** True while browser speech or server mic capture is active (same rules as TranscriptComposer voice). */
  voiceActive?: boolean;
  onVoiceToggle?: () => void;
  onSendChunk?: (payload: { text: string; speakerId: string }) => boolean;
  sendChunkDisabled?: boolean;
  getDefaultSpeakerId?: () => string;
}

export function SessionOverlay({
  onClose,
  voiceActive = false,
  onVoiceToggle,
  onSendChunk,
  sendChunkDisabled = true,
  getDefaultSpeakerId,
}: SessionOverlayProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chunkDialogOpen, setChunkDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [pos, setPos] = useState(() => ({
    x: window.innerWidth / 2 - PANEL_WIDTH / 2,
    y: window.innerHeight - 80,
  }));

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const resetTimer = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!dragging) setVisible(false);
    }, INACTIVITY_MS);
  }, [dragging]);

  useEffect(() => {
    window.addEventListener("mousemove", resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  useEffect(() => {
    if (dragging) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(true);
    }
  }, [dragging]);

  const handleStop = (_: DraggableEvent, d: DraggableData) => {
    setDragging(false);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const el = nodeRef.current;
    const w = el?.offsetWidth ?? PANEL_WIDTH;
    const h = el?.offsetHeight ?? 64;
    let { x, y } = d;
    if (x < SNAP_THRESHOLD) x = SNAP_PAD;
    else if (x + w > W - SNAP_THRESHOLD) x = W - w - SNAP_PAD;
    if (y < SNAP_THRESHOLD) y = SNAP_PAD;
    else if (y + h > H - SNAP_THRESHOLD) y = H - h - SNAP_PAD;
    setPos({ x, y });
    resetTimer();
  };

  const handleOpenChunk = useCallback(() => {
    if (!onSendChunk) return;
    setChunkDialogOpen(true);
  }, [onSendChunk]);

  const handleClose = useCallback(() => {
    setDismissed(true);
    onClose?.();
  }, [onClose]);

  if (dismissed) return null;

  const isVisible = mounted && visible;

  return createPortal(
    <>
      <Draggable
        nodeRef={nodeRef}
        position={pos}
        onStart={() => setDragging(true)}
        onDrag={(_, d) => setPos({ x: d.x, y: d.y })}
        onStop={handleStop}
        bounds="window"
      >
        <div
          ref={nodeRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 9999,
            userSelect: "none",
            transition: dragging ? "none" : "transform 380ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "scale(1) translateY(0)" : "scale(0.88) translateY(6px)",
              transition: "opacity 280ms ease, transform 280ms cubic-bezier(0.34,1.56,0.64,1)",
              pointerEvents: isVisible ? "auto" : "none",
            }}
          >
            <div
              role="toolbar"
              aria-label="Session controls"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 12px",
                width: PANEL_WIDTH,
                boxSizing: "border-box",
                background: "rgba(10,12,16,0.82)",
                backdropFilter: "blur(28px) saturate(180%)",
                WebkitBackdropFilter: "blur(28px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderTop: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 999,
                boxShadow: "0 16px 48px rgba(0,0,0,0.50), 0 4px 16px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
                cursor: dragging ? "grabbing" : "grab",
              }}
            >
              <OvBtn
                variant={voiceActive ? "red" : "teal"}
                ariaLabel={voiceActive ? "Stop voice input" : "Start voice input"}
                onClick={() => onVoiceToggle?.()}
                size={40}
              >
                {voiceActive ? <IconMicOff /> : <IconMicOn />}
              </OvBtn>

              <OvBtn
                variant="teal"
                ariaLabel="Send transcript chunk"
                onClick={handleOpenChunk}
                active={chunkDialogOpen}
                size={40}
                disabled={!onSendChunk}
              >
                <IconSendChunk />
              </OvBtn>

              <div aria-hidden="true" style={{ flex: 1 }} />

              <div aria-hidden="true" style={{ width: 1, height: 20, background: "rgba(255,255,255,0.09)", flexShrink: 0 }} />

              <OvBtn variant="ghost" ariaLabel="Close overlay" onClick={handleClose} size={32}>
                <IconClose />
              </OvBtn>
            </div>
          </div>
        </div>
      </Draggable>
      {onSendChunk ? (
        <OverlayChunkDialog
          open={chunkDialogOpen}
          onClose={() => setChunkDialogOpen(false)}
          disabled={sendChunkDisabled}
          onSendChunk={onSendChunk}
          getDefaultSpeakerId={getDefaultSpeakerId}
        />
      ) : null}
    </>,
    document.body,
  );
}
