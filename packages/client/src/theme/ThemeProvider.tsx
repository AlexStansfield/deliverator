import { useEffect, type ReactNode } from "react";
import { usePreferences } from "@/lib/prefs";
import { applyTheme, readStoredThemeId, resolveTheme, storeThemeId, SYSTEM_THEME_ID } from "./themes";

/** Applies the saved theme immediately (from localStorage) and again once server preferences load. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { prefs, loaded } = usePreferences();
  const id = loaded ? prefs.theme : (readStoredThemeId() ?? prefs.theme);

  useEffect(() => {
    applyTheme(resolveTheme(id));
    storeThemeId(id);
    if (id !== SYSTEM_THEME_ID) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme(id));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [id]);

  return <>{children}</>;
}
