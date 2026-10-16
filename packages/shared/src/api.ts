import type { Download } from "./downloads.js";
import type { ProviderStatus, ProviderSummary } from "./providers.js";

/** Snapshot pushed over the event stream and returned by GET /api/state */
export interface StateSnapshot {
  providers: ProviderSummary[];
  statuses: ProviderStatus[];
  downloads: Download[];
  /** unix ms */
  generatedAt: number;
}

export interface AddDownloadRequest {
  /** Magnets, .torrent URLs, .nzb URLs; one per entry */
  urls: string[];
  /** Explicit provider; omit for auto-detect */
  providerId?: string;
  category?: string;
  paused?: boolean;
}

export interface AddDownloadResult {
  added: { url: string; providerId: string }[];
  failed: { url: string; reason: string }[];
}

export interface UserPreferences {
  theme: string;
  /** ms */
  refreshInterval: number;
  /** bytes/second values offered as one-click limits */
  speedPresets: number[];
  confirmDelete: boolean;
  deleteFilesByDefault: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "midnight",
  refreshInterval: 2000,
  speedPresets: [2_000_000, 5_000_000, 10_000_000],
  confirmDelete: true,
  deleteFilesByDefault: true,
};

export interface AppInfo {
  name: string;
  version: string;
  basePath: string;
  authenticated: boolean;
}
