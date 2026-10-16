import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ToastProvider } from "./lib/toast";
import { LiveStateProvider } from "./lib/state";
import { basePath } from "./lib/env";
import { applyTheme, readStoredThemeId, resolveTheme } from "./theme/themes";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";

// Paint the remembered theme before React mounts to avoid a flash of the default.
applyTheme(resolveTheme(readStoredThemeId() ?? "midnight"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basePath || "/"}>
        <ToastProvider>
          <AuthProvider>
            <ThemeProvider>
              <LiveStateProvider>
                <App />
              </LiveStateProvider>
            </ThemeProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
