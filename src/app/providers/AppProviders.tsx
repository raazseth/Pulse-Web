import { PropsWithChildren } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { AuthProvider, useAuth } from "@/modules/auth/hooks/useAuthStore";
import { SessionStoreProvider } from "@/modules/context/hooks/useSessionStore";
import { SessionListProvider } from "@/modules/context/hooks/useSessionList";
import { ToastProvider } from "@/shared/components/Toast";
import { appTheme } from "./theme";

function SessionStoreWithUserKey({ children }: PropsWithChildren) {
  const { user } = useAuth();
  return (
    <SessionStoreProvider key={user?.id ?? "__signed_out__"}>{children}</SessionStoreProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={appTheme}>
      <ToastProvider>
        <AuthProvider>
          <SessionListProvider>
            <SessionStoreWithUserKey>{children}</SessionStoreWithUserKey>
          </SessionListProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
