import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/features/auth/providers/auth-provider";
import "./index.css";
import App from "./app/app";
import { AppThemeProvider } from "./app/providers/theme-provider";
import { PendingAttachmentsProvider } from "@/features/requests/providers/pending-attachments-provider";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root element was not found.");

const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PendingAttachmentsProvider>
            <App />
          </PendingAttachmentsProvider>
        </AuthProvider>
      </QueryClientProvider>
    ),
  },
]);

createRoot(rootElement).render(
  <AppThemeProvider>
    <RouterProvider router={router} />
  </AppThemeProvider>,
);
