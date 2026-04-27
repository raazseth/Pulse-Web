import { createBrowserRouter } from "react-router-dom";
import { AuthPage } from "@/modules/auth/components/AuthPage";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { DashboardLayout } from "@/layouts/dashboard/DashboardLayout";
import { App } from "@/app/App";
import { SessionsPage } from "@/pages/SessionsPage";
import { ErrorBoundary } from "@/app/ErrorBoundary";

export const appRouter = createBrowserRouter([
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
]);
