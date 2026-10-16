/**
 * The single download vocabulary every provider is normalised into.
 * Keep this small: it is what the UI renders and what filters are built on.
 */
export const DOWNLOAD_STATES = [
  "downloading",
  "queued",
  "paused",
  "checking",
  "repairing",
  "extracting",
  "seeding",
  "completed",
  "failed",
] as const;

export type DownloadState = (typeof DOWNLOAD_STATES)[number];

export interface Download {
  /** Globally unique within Deliverator: `${providerId}:${nativeId}` */
  id: string;
  providerId: string;
  /** The id the provider itself uses (torrent hash, nzo_id). */
  nativeId: string;
  name: string;
  state: DownloadState;
  /** 0..1 */
  progress: number;
  /** bytes, 0 if unknown */
  size: number;
  /** bytes */
  downloaded: number;
  /** bytes/second */
  downloadSpeed: number;
  /** bytes/second, torrents only */
  uploadSpeed: number;
  /** seconds, null if unknown or not applicable */
  eta: number | null;
  category: string | null;
  savePath: string | null;
  /** unix ms */
  addedAt: number | null;
  /** unix ms */
  completedAt: number | null;
  /** Human-readable failure reason when state === "failed" */
  error: string | null;
  /** Provider-specific extras that are cheap to show. */
  torrent?: {
    ratio: number;
    seedingTime: number;
    peers: number;
    seeds: number;
  };
  usenet?: {
    /** position in the SABnzbd queue, 0-based */
    queueIndex: number;
    /** e.g. "Verifying", "Repairing 42%" */
    stage: string | null;
  };
}

export interface DownloadFile {
  name: string;
  size: number;
  /** 0..1 */
  progress: number;
}

export interface DownloadDetails {
  download: Download;
  files: DownloadFile[];
}
