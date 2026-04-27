import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { AuthPage } from "@/modules/auth/components/AuthPage";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { DashboardLayout } from "@/layouts/dashboard/DashboardLayout";
import { App } from "@/app/App";
import { SessionsPage } from "@/pages/SessionsPage";
import { ErrorBoundary } from "@/app/ErrorBoundary";

const routeObjects = [
  {
    path: "/login",
    element: <AuthPage />,
  },
  {
    path: "/",
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <App /> },
      { path: "sessions", element: <SessionsPage /> },
    ],
  },
];

function useHashRouterForFileProtocol(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:" || window.location.href.startsWith("file:");
}

/** Hash routes when served from `file://` (Electron `loadFile`), so paths are not drive letters. */
export const appRouter = useHashRouterForFileProtocol()
  ? createHashRouter(routeObjects)
  : createBrowserRouter(routeObjects);
