import { PropsWithChildren } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { AuthProvider } from "@/modules/auth/hooks/useAuthStore";
import { SessionStoreProvider } from "@/modules/context/hooks/useSessionStore";
import { SessionListProvider } from "@/modules/context/hooks/useSessionList";
import { ToastProvider } from "@/shared/components/Toast";
import { appTheme } from "./theme";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={appTheme}>
      <ToastProvider>
        <AuthProvider>
          <SessionListProvider>
            <SessionStoreProvider>{children}</SessionStoreProvider>
          </SessionListProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
