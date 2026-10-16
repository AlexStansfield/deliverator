import type { Download, DownloadFile, DownloadState, ProviderCapabilities, SpeedLimits } from "@deliverator/shared";
import {
  ProviderError,
  fetchWithTimeout,
  joinUrl,
  type AdapterOptions,
  type AddRequest,
  type FetchFn,
  type PollResult,
  type ProviderAdapter,
} from "./types.js";

/* SABnzbd API: https://sabnzbd.org/wiki/advanced/api */

export const SABNZBD_CAPABILITIES: ProviderCapabilities = {
  torrents: false,
  nzbs: true,
  uploadSpeedLimit: false,
  altSpeedToggle: false,
  categories: true,
  retry: true,
  reorder: true,
  pauseResume: true,
  deleteFiles: true,
  freeSpace: true,
};

interface SabQueueSlot {
  nzo_id: string;
  filename: string;
  status: string;
  mb: string;
  mbleft: string;
  percentage: string;
  timeleft: string;
  cat: string;
  index: number;
  avg_age?: string;
  labels?: string[];
}

interface SabQueue {
  paused: boolean;
  kbpersec: string;
  speedlimit_abs?: string;
  speedlimit?: string;
  diskspace1?: string;
  status?: string;
  version?: string;
  slots: SabQueueSlot[];
}

interface SabHistorySlot {
  nzo_id: string;
  name: string;
  status: string;
  fail_message?: string;
  bytes: number;
  category: string;
  completed: number;
  storage?: string;
  path?: string;
  action_line?: string;
  stage_log?: { name: string; actions: string[] }[];
}

interface SabHistory {
  slots: SabHistorySlot[];
}

const HISTORY_LIMIT = 200;

function num(s: string | number | undefined, fallback = 0): number {
  if (typeof s === "number") return s;
  if (!s) return fallback;
  const n = Number.parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** "0:04:21" or "1:02:03:04" -> seconds */
export function parseTimeleft(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  let secs = 0;
  for (const p of parts) secs = secs * 60 + p;
  if (parts.length === 4) {
    const [d, h, m, sec] = parts as [number, number, number, number];
    secs = d * 86400 + h * 3600 + m * 60 + sec;
  }
  return secs;
}

export function mapSabQueueStatus(status: string, queuePaused: boolean): DownloadState {
  switch (status) {
    case "Downloading":
      return queuePaused ? "paused" : "downloading";
    case "Paused":
      return "paused";
    case "Queued":
    case "Grabbing":
    case "Fetching":
    case "Propagating":
      return "queued";
    case "Checking":
      return "checking";
    default:
      return queuePaused ? "paused" : "downloading";
  }
}

export function mapSabHistoryStatus(status: string): { state: DownloadState; stage: string | null } {
  switch (status) {
    case "Completed":
      return { state: "completed", stage: null };
    case "Failed":
      return { state: "failed", stage: null };
    case "Repairing":
      return { state: "repairing", stage: "Repairing" };
    case "Verifying":
    case "Checking":
      return { state: "repairing", stage: "Verifying" };
    case "Extracting":
    case "Moving":
    case "Running":
      return { state: "extracting", stage: status === "Running" ? "Running script" : status };
    case "Queued":
    case "Fetching":
      return { state: "extracting", stage: "Waiting for post-processing" };
    default:
      return { state: "extracting", stage: status };
  }
}

export class SABnzbdAdapter implements ProviderAdapter {
  readonly type = "sabnzbd" as const;
  readonly capabilities = SABNZBD_CAPABILITIES;
  private readonly fetchFn: FetchFn;
  private readonly timeoutMs: number;

  constructor(
    private readonly providerId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    opts: AdapterOptions = {},
  ) {
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  private async call<T>(params: Record<string, string>, init: RequestInit = {}, opts: { allowFalse?: boolean } = {}): Promise<T> {
    const qs = new URLSearchParams({ ...params, output: "json", apikey: this.apiKey });
    const res = await fetchWithTimeout(this.fetchFn, joinUrl(this.baseUrl, `/api?${qs}`), init, this.timeoutMs);
    if (res.status === 401 || res.status === 403) throw new ProviderError("SABnzbd rejected the API key", res.status);
    if (!res.ok) throw new ProviderError(`SABnzbd ${params.mode} failed: ${res.status}`, res.status);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ProviderError(`SABnzbd returned something that is not JSON for ${params.mode}. Is the URL pointing at SABnzbd?`);
    }
    const obj = body as { status?: boolean; error?: string };
    if (obj && typeof obj.error === "string" && /api key/i.test(obj.error)) throw new ProviderError("SABnzbd rejected the API key", 401);
    if (obj && obj.status === false && !opts.allowFalse) throw new ProviderError(obj.error || `SABnzbd ${params.mode} failed`);
    return body as T;
  }

  async testConnection(): Promise<{ version: string }> {
    const v = await this.call<{ version: string }>({ mode: "version" });
    // "version" works without a key on some setups; make sure the key is actually accepted.
    await this.call<{ queue: unknown }>({ mode: "queue", limit: "1" });
    return { version: v.version };
  }

  async poll(): Promise<PollResult> {
    const [q, h, cats] = await Promise.all([
      this.call<{ queue: SabQueue }>({ mode: "queue" }),
      this.call<{ history: SabHistory }>({ mode: "history", limit: String(HISTORY_LIMIT) }),
      this.call<{ categories: string[] }>({ mode: "get_cats" }).catch(() => ({ categories: [] as string[] })),
    ]);
    const queue = q.queue;
    const downloads: Download[] = [];
    let remaining = 0;
    for (const s of queue.slots ?? []) {
      const d = this.queueToDownload(s, queue.paused);
      remaining += Math.max(0, d.size - d.downloaded);
      downloads.push(d);
    }
    for (const s of h.history?.slots ?? []) downloads.push(this.historyToDownload(s));
    const speed = Math.round(num(queue.kbpersec) * 1024);
    this.attributeSpeed(downloads, speed);
    const speedLimitAbs = num(queue.speedlimit_abs);
    return {
      status: {
        version: queue.version ?? null,
        downloadSpeed: speed,
        uploadSpeed: 0,
        freeSpace: queue.diskspace1 ? Math.round(num(queue.diskspace1) * 1024 ** 3) : null,
        remainingBytes: remaining,
        limits: { download: speedLimitAbs > 0 && num(queue.speedlimit, 100) < 100 ? speedLimitAbs : 0 },
        paused: Boolean(queue.paused),
      },
      downloads,
      categories: (cats.categories ?? []).filter((c) => c !== "*").sort(),
    };
  }

  private queueToDownload(s: SabQueueSlot, queuePaused: boolean): Download {
    const size = Math.round(num(s.mb) * 1024 * 1024);
    const left = Math.round(num(s.mbleft) * 1024 * 1024);
    const state = mapSabQueueStatus(s.status, queuePaused);
    return {
      id: `${this.providerId}:${s.nzo_id}`,
      providerId: this.providerId,
      nativeId: s.nzo_id,
      name: s.filename,
      state,
      progress: size > 0 ? Math.max(0, Math.min(1, (size - left) / size)) : 0,
      size,
      downloaded: Math.max(0, size - left),
      downloadSpeed: 0,
      uploadSpeed: 0,
      eta: state === "downloading" ? parseTimeleft(s.timeleft) : null,
      category: s.cat && s.cat !== "*" ? s.cat : null,
      savePath: null,
      addedAt: null,
      completedAt: null,
      error: null,
      usenet: { queueIndex: s.index, stage: s.status === "Downloading" ? null : s.status },
    };
  }

  private historyToDownload(s: SabHistorySlot): Download {
    const { state, stage } = mapSabHistoryStatus(s.status);
    return {
      id: `${this.providerId}:${s.nzo_id}`,
      providerId: this.providerId,
      nativeId: s.nzo_id,
      name: s.name,
      state,
      progress: state === "failed" ? 0 : 1,
      size: s.bytes ?? 0,
      downloaded: s.bytes ?? 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      eta: null,
      category: s.category && s.category !== "*" ? s.category : null,
      savePath: s.storage || s.path || null,
      addedAt: null,
      completedAt: s.completed ? s.completed * 1000 : null,
      error: state === "failed" ? s.fail_message || "Download failed" : null,
      usenet: { queueIndex: -1, stage: stage ?? (state !== "completed" && s.action_line ? s.action_line : null) },
    };
  }

  async add(req: AddRequest): Promise<void> {
    for (const url of req.urls ?? []) {
      const params: Record<string, string> = { mode: "addurl", name: url };
      if (req.category) params.cat = req.category;
      if (req.paused) params.priority = "-2";
      await this.call({ ...params });
    }
    for (const f of req.files ?? []) {
      const body = new FormData();
      body.append("nzbfile", new Blob([new Uint8Array(f.data)], { type: "application/x-nzb" }), f.name);
      const params: Record<string, string> = { mode: "addfile" };
      if (req.category) params.cat = req.category;
      if (req.paused) params.priority = "-2";
      await this.call(params, { method: "POST", body });
    }
  }

  /** Only the speed of the whole queue is reported; attribute it to the item actively downloading. */
  private attributeSpeed(downloads: Download[], totalSpeed: number): void {
    const active = downloads.filter((d) => d.state === "downloading");
    if (active.length === 0) return;
    const first = active[0]!;
    first.downloadSpeed = totalSpeed;
    if (first.eta === null && totalSpeed > 0) first.eta = Math.round((first.size - first.downloaded) / totalSpeed);
  }

  async pause(ids: string[]) {
    await this.call({ mode: "queue", name: "pause", value: ids.join(",") });
  }
  async resume(ids: string[]) {
    await this.call({ mode: "queue", name: "resume", value: ids.join(",") });
  }
  async remove(ids: string[], deleteFiles: boolean) {
    const del = deleteFiles ? "1" : "0";
    // An item lives either in the queue or in history. SABnzbd answers status:false for the
    // one it is not in, so try both and only fail when neither claims it.
    type Reply = { status?: boolean; error?: string; nzo_ids?: string[] };
    const q = await this.call<Reply>({ mode: "queue", name: "delete", value: ids.join(","), del_files: del }, {}, { allowFalse: true });
    const h = await this.call<Reply>({ mode: "history", name: "delete", value: ids.join(","), del_files: del }, {}, { allowFalse: true });
    if (q.status === false && h.status === false) {
      throw new ProviderError(q.error || h.error || "SABnzbd could not find that download in its queue or history");
    }
  }
  async moveToTop(ids: string[]) {
    for (const id of ids) await this.call({ mode: "switch", value: id, value2: "0" });
  }
  async moveToBottom(ids: string[]) {
    for (const id of ids) await this.call({ mode: "switch", value: id, value2: "9999" });
  }
  async retry(ids: string[]) {
    for (const id of ids) await this.call({ mode: "retry", value: id });
  }
  async setCategory(ids: string[], category: string) {
    await this.call({ mode: "change_cat", value: ids.join(","), value2: category });
  }
  async setSpeedLimits(limits: Partial<SpeedLimits>) {
    if (typeof limits.download !== "number") return;
    const value = limits.download <= 0 ? "0" : `${Math.max(1, Math.round(limits.download / 1024))}K`;
    await this.call({ mode: "config", name: "speedlimit", value });
  }
  async pauseAll() {
    await this.call({ mode: "pause" });
  }
  async resumeAll() {
    await this.call({ mode: "resume" });
  }
  async files(id: string): Promise<DownloadFile[]> {
    const r = await this.call<{ files?: { filename: string; bytes?: string; mb?: string; mbleft?: string }[] }>({ mode: "get_files", value: id });
    return (r.files ?? []).map((f) => {
      const size = f.bytes ? num(f.bytes) : Math.round(num(f.mb) * 1024 * 1024);
      const left = Math.round(num(f.mbleft) * 1024 * 1024);
      return { name: f.filename, size, progress: size > 0 ? Math.max(0, Math.min(1, (size - left) / size)) : 1 };
    });
  }
}
