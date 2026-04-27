import { createContext, PropsWithChildren, useCallback, useContext, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

type Severity = "error" | "warning" | "info" | "success";

interface ToastOptions {
  message: string;
  severity?: Severity;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions | string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastState {
  open: boolean;
  message: string;
  severity: Severity;
  duration: number;
}

const INITIAL: ToastState = { open: false, message: "", severity: "error", duration: 4000 };

export function ToastProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ToastState>(INITIAL);

  const toast = useCallback((opts: ToastOptions | string) => {
    const { message, severity = "error", duration = 4000 } =
      typeof opts === "string" ? { message: opts } : opts;
    setState({ open: true, message, severity, duration });
  }, []);

  const handleClose = (_: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    setState((s) => ({ ...s, open: false }));
  };

  const SEVERITY_STYLES: Record<Severity, React.CSSProperties & Record<string, unknown>> = {
    error: {
      bgcolor: "#FEF2F2",
      border: "1px solid #FECACA",
      color: "#DC2626",
      "& .MuiAlert-icon": { color: "#DC2626" },
      "& .MuiAlert-action .MuiIconButton-root": { color: "#DC2626" },
    },
    warning: {
      bgcolor: "#FFFBEB",
      border: "1px solid #FDE68A",
      color: "#D97706",
      "& .MuiAlert-icon": { color: "#D97706" },
    },
    info: {
      bgcolor: "#EFF6FF",
      border: "1px solid #BFDBFE",
      color: "#2563EB",
      "& .MuiAlert-icon": { color: "#2563EB" },
    },
    success: {
      bgcolor: "#F0FDF4",
      border: "1px solid #BBF7D0",
      color: "#16A34A",
      "& .MuiAlert-icon": { color: "#16A34A" },
    },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={state.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={state.severity}
          onClose={handleClose}
          sx={{
            borderRadius: "10px",
            fontSize: "0.875rem",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            ...SEVERITY_STYLES[state.severity],
          }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
