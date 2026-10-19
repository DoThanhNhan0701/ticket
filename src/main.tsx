import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/features/auth/providers/auth-provider";
import "./index.css";
import App from "./app/app";
import { AppThemeProvider } from "./app/providers/theme-provider";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root element was not found.");

createRoot(rootElement).render(
  <StrictMode>
    <AppThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </AppThemeProvider>
  </StrictMode>,
);
