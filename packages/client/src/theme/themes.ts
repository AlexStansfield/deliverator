/**
 * Theme registry. To add a theme, append an entry here: the id is stored in preferences,
 * `dark` picks the browser colour scheme for form controls, and every token below is set
 * as a CSS variable on <html>. Tailwind utilities (bg-panel, text-muted, …) read those variables.
 */
export interface ThemeTokens {
  /** page background */
  bg: string;
  /** cards, table, top bar */
  panel: string;
  /** hover rows, inputs, nested surfaces */
  panel2: string;
  /** hairline borders */
  line: string;
  /** primary text */
  fg: string;
  /** secondary text */
  muted: string;
  /** tertiary text, disabled */
  faint: string;
  /** primary action colour */
  accent: string;
  /** text on top of the accent */
  accentInk: string;
  /** semantic: downloading */
  down: string;
  /** semantic: uploading / seeding */
  up: string;
  /** semantic: completed, healthy */
  ok: string;
  /** semantic: repairing, waiting, limited */
  warn: string;
  /** semantic: failed */
  bad: string;
  /** progress-bar track */
  track: string;
}

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  tokens: ThemeTokens;
}

export const themes: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    dark: true,
    tokens: {
      bg: "#0f1216", panel: "#161a20", panel2: "#1c2129", line: "#262c36",
      fg: "#e8ebf0", muted: "#8b94a3", faint: "#5c6573",
      accent: "#f29b4a", accentInk: "#1a1208",
      down: "#58a6ff", up: "#b48cff", ok: "#3ecf8e", warn: "#f2c24a", bad: "#ff6b6b", track: "#262c36",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    dark: true,
    tokens: {
      bg: "#121212", panel: "#1a1a1a", panel2: "#222222", line: "#2c2c2c",
      fg: "#ececec", muted: "#9a9a9a", faint: "#6a6a6a",
      accent: "#4cc2ff", accentInk: "#06212e",
      down: "#4cc2ff", up: "#c084fc", ok: "#4ade80", warn: "#fbbf24", bad: "#f87171", track: "#2c2c2c",
    },
  },
  {
    id: "nord",
    name: "Nord",
    dark: true,
    tokens: {
      bg: "#2e3440", panel: "#3b4252", panel2: "#434c5e", line: "#4c566a",
      fg: "#eceff4", muted: "#aab2c4", faint: "#7b86a0",
      accent: "#88c0d0", accentInk: "#1b2430",
      down: "#81a1c1", up: "#b48ead", ok: "#a3be8c", warn: "#ebcb8b", bad: "#bf616a", track: "#4c566a",
    },
  },
  {
    id: "forest",
    name: "Forest",
    dark: true,
    tokens: {
      bg: "#0e1512", panel: "#141d18", panel2: "#1b2620", line: "#243129",
      fg: "#e6efe9", muted: "#8fa69a", faint: "#5f766a",
      accent: "#7ee2a8", accentInk: "#06120b",
      down: "#6cc3ff", up: "#c9a2ff", ok: "#7ee2a8", warn: "#f3cf6f", bad: "#ff8080", track: "#243129",
    },
  },
  {
    id: "paper",
    name: "Paper",
    dark: false,
    tokens: {
      bg: "#f6f3ee", panel: "#fffdf9", panel2: "#f1ede6", line: "#e3ddd2",
      fg: "#1f1c17", muted: "#6d665b", faint: "#9a927f",
      accent: "#c2541c", accentInk: "#ffffff",
      down: "#1d5fd1", up: "#7a3fd6", ok: "#1c8a55", warn: "#a56a0b", bad: "#c43a3a", track: "#e3ddd2",
    },
  },
  {
    id: "daylight",
    name: "Daylight",
    dark: false,
    tokens: {
      bg: "#f3f4f7", panel: "#ffffff", panel2: "#f7f8fa", line: "#e1e4ea",
      fg: "#15181d", muted: "#5d6675", faint: "#8b94a3",
      accent: "#e0801f", accentInk: "#ffffff",
      down: "#1f6feb", up: "#7c4dff", ok: "#1a9e63", warn: "#b7791f", bad: "#d64545", track: "#e6e9ef",
    },
  },
];

/** Special id: follow the OS preference, using these two themes. */
export const SYSTEM_THEME_ID = "system";
export const SYSTEM_DARK = "midnight";
export const SYSTEM_LIGHT = "daylight";

export function resolveTheme(id: string): Theme {
  if (id === SYSTEM_THEME_ID) {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
    id = prefersDark ? SYSTEM_DARK : SYSTEM_LIGHT;
  }
  return themes.find((t) => t.id === id) ?? themes[0]!;
}

const TOKEN_TO_VAR: Record<keyof ThemeTokens, string> = {
  bg: "--bg", panel: "--panel", panel2: "--panel-2", line: "--line", fg: "--fg", muted: "--muted", faint: "--faint",
  accent: "--accent", accentInk: "--accent-ink", down: "--down", up: "--up", ok: "--ok", warn: "--warn", bad: "--bad", track: "--track",
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(TOKEN_TO_VAR) as [keyof ThemeTokens, string][]) {
    root.style.setProperty(cssVar, theme.tokens[key]);
  }
  root.style.colorScheme = theme.dark ? "dark" : "light";
  root.dataset.theme = theme.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.tokens.panel);
}

const STORAGE_KEY = "deliverator.theme";
export function readStoredThemeId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
export function storeThemeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
}
