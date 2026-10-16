export const PROVIDER_TYPES = ["qbittorrent", "sabnzbd"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** What a provider type can do; the UI hides controls that are not supported. */
export interface ProviderCapabilities {
  /** Accepts magnet links / .torrent URLs / .torrent files */
  torrents: boolean;
  /** Accepts .nzb URLs / .nzb files */
  nzbs: boolean;
  uploadSpeedLimit: boolean;
  /** qBittorrent "alternative speed limits" style toggle */
  altSpeedToggle: boolean;
  categories: boolean;
  /** Can a failed item be retried in place? */
  retry: boolean;
  /** Reorder queue (move to top / bottom) */
  reorder: boolean;
  /** Pause / resume individual items */
  pauseResume: boolean;
  /** Can delete downloaded files along with the item */
  deleteFiles: boolean;
  /** Reports free disk space */
  freeSpace: boolean;
}

export interface SpeedLimits {
  /** bytes/second, 0 = unlimited */
  download: number;
  /** bytes/second, 0 = unlimited; absent when unsupported */
  upload?: number;
  /** qBittorrent alternative limits engaged */
  altEnabled?: boolean;
}

export interface ProviderStatus {
  providerId: string;
  connected: boolean;
  /** Error from the last poll if not connected */
  error: string | null;
  version: string | null;
  downloadSpeed: number;
  uploadSpeed: number;
  /** bytes, null if unsupported */
  freeSpace: number | null;
  /** bytes still to download across the queue, null if unknown */
  remainingBytes: number | null;
  limits: SpeedLimits;
  /** Whole-provider pause (SABnzbd queue pause) */
  paused: boolean;
  /** unix ms of the last successful poll */
  updatedAt: number | null;
}

/** Provider config as exposed to the client; secrets never leave the server. */
export interface ProviderSummary {
  id: string;
  type: ProviderType;
  name: string;
  url: string;
  enabled: boolean;
  capabilities: ProviderCapabilities;
  /** Categories known to the provider (qBittorrent categories, SABnzbd categories) */
  categories: string[];
  createdAt: number;
}
