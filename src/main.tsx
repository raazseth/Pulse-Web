import React from "react";
import ReactDOM from "react-dom/client";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
} else if (import.meta.env.PROD && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
import { CssBaseline, GlobalStyles } from "@mui/material";
import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { appRouter } from "@/app/routes";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <CssBaseline />
      <GlobalStyles
        styles={{
          ":root": {
            colorScheme: "light",
            fontFamily: '"Public Sans", "Segoe UI", sans-serif',
          },
          "html, body, #root": {
            minHeight: "100%",
            margin: 0,
            backgroundColor: "#F4F6F8",
          },
          body: {
            backgroundColor: "#F4F6F8",
          },
          "*": {
            boxSizing: "border-box",
          },
        }}
      />
      <RouterProvider router={appRouter} />
    </AppProviders>
  </React.StrictMode>,
);
