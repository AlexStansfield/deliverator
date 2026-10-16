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

/* qBittorrent WebUI API v2: https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0) */

export const QBITTORRENT_CAPABILITIES: ProviderCapabilities = {
  torrents: true,
  nzbs: false,
  uploadSpeedLimit: true,
  altSpeedToggle: true,
  categories: true,
  retry: true,
  reorder: true,
  pauseResume: true,
  deleteFiles: true,
  freeSpace: true,
};

interface QbTorrent {
  hash: string;
  name: string;
  state: string;
  progress: number;
  size: number;
  total_size?: number;
  downloaded: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  category: string;
  save_path: string;
  added_on: number;
  completion_on: number;
  ratio: number;
  seeding_time?: number;
  num_seeds: number;
  num_leechs: number;
  amount_left?: number;
}

interface QbMainData {
  torrents?: Record<string, Partial<QbTorrent>>;
  categories?: Record<string, { name: string }>;
  server_state?: {
    dl_info_speed?: number;
    up_info_speed?: number;
    dl_rate_limit?: number;
    up_rate_limit?: number;
    use_alt_speed_limits?: boolean;
    free_space_on_disk?: number;
  };
}

const INFINITE_ETA = 8640000;

export function mapQbState(state: string): { state: DownloadState; error: string | null } {
  switch (state) {
    case "downloading":
    case "forcedDL":
    case "metaDL":
    case "forcedMetaDL":
    case "stalledDL":
    case "allocating":
      return { state: "downloading", error: null };
    case "queuedDL":
      return { state: "queued", error: null };
    case "pausedDL":
    case "stoppedDL":
      return { state: "paused", error: null };
    case "checkingDL":
    case "checkingUP":
    case "checkingResumeData":
    case "moving":
      return { state: "checking", error: null };
    case "uploading":
    case "forcedUP":
    case "stalledUP":
    case "queuedUP":
      return { state: "seeding", error: null };
    case "pausedUP":
    case "stoppedUP":
      return { state: "completed", error: null };
    case "missingFiles":
      return { state: "failed", error: "Files are missing on disk" };
    case "error":
      return { state: "failed", error: "qBittorrent reported an error" };
    default:
      return { state: "failed", error: `Unknown state "${state}"` };
  }
}

export class QBittorrentAdapter implements ProviderAdapter {
  readonly type = "qbittorrent" as const;
  readonly capabilities = QBITTORRENT_CAPABILITIES;
  private readonly fetchFn: FetchFn;
  private readonly timeoutMs: number;
  private cookie: string | null = null;
  /** qBittorrent 5 renamed pause/resume to stop/start; remember which this server speaks. */
  private legacyVerbs: boolean | null = null;

  constructor(
    private readonly providerId: string,
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    opts: AdapterOptions = {},
  ) {
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  private async login(): Promise<void> {
    const res = await fetchWithTimeout(
      this.fetchFn,
      joinUrl(this.baseUrl, "/api/v2/auth/login"),
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", referer: this.baseUrl, origin: this.baseUrl },
        body: new URLSearchParams({ username: this.username, password: this.password }).toString(),
      },
      this.timeoutMs,
    );
    const text = (await res.text()).trim();
    // Older versions answer 200 "Ok." / "Fails."; qBittorrent 5.2+ answers 204 on success.
    if (res.status === 403) throw new ProviderError("qBittorrent banned this address after too many failed logins. Wait a few minutes.", 403);
    if (res.ok && text === "Fails.") throw new ProviderError("qBittorrent rejected the username or password", 401);
    if (!res.ok || (res.status === 200 && text !== "Ok.")) {
      const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
      if (res.status === 401) {
        throw new ProviderError(
          "qBittorrent rejected the login. Either the username or password is wrong, or its Host header validation blocked the request: use the port qBittorrent itself listens on (not a remapped one), or add this host under WebUI → Server domains.",
          401,
        );
      }
      throw new ProviderError(`qBittorrent login returned ${res.status}${snippet ? ` "${snippet}"` : ""}. Check that the URL points at the qBittorrent WebUI.`, res.status);
    }
    // Cookie is "SID" on 4.x/5.0 and "QBT_SID_<port>" on newer versions.
    const setCookie = res.headers.get("set-cookie") ?? "";
    const m = setCookie.match(/(?:^|[\s,;])((?:QBT_)?SID[^=;,\s]*)=([^;]+)/);
    if (!m) {
      // Some setups (bypass auth for localhost / whitelisted subnets) never issue a cookie.
      this.cookie = null;
      return;
    }
    this.cookie = `${m[1]}=${m[2]}`;
  }

  private async request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    if (this.cookie === null && retry) await this.login();
    const headers = new Headers(init.headers);
    headers.set("referer", this.baseUrl);
    headers.set("origin", this.baseUrl);
    if (this.cookie) headers.set("cookie", this.cookie);
    const res = await fetchWithTimeout(this.fetchFn, joinUrl(this.baseUrl, path), { ...init, headers }, this.timeoutMs);
    if (res.status === 403 && retry) {
      this.cookie = null;
      await this.login();
      return this.request(path, init, false);
    }
    return res;
  }

  private async form(path: string, fields: Record<string, string>): Promise<Response> {
    const res = await this.request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
    if (!res.ok) {
      const body = (await res.text()).trim().slice(0, 200);
      if (res.status === 409 && path.endsWith("/setCategory")) throw new ProviderError(`qBittorrent does not have a category named "${fields.category}"`, 409);
      throw new ProviderError(`qBittorrent ${path.replace("/api/v2/", "")} failed: ${res.status}${body ? ` ${body}` : ""}`, res.status);
    }
    return res;
  }

  private async json<T>(path: string): Promise<T> {
    const res = await this.request(path);
    if (!res.ok) throw new ProviderError(`qBittorrent ${path} failed: ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  async testConnection(): Promise<{ version: string }> {
    this.cookie = null;
    await this.login();
    const res = await this.request("/api/v2/app/version");
    if (!res.ok) throw new ProviderError(`Logged in but could not read version (${res.status})`, res.status);
    return { version: (await res.text()).trim() };
  }

  async poll(): Promise<PollResult> {
    const [data, versionRes] = await Promise.all([this.json<QbMainData>("/api/v2/sync/maindata?rid=0"), this.request("/api/v2/app/version")]);
    const version = versionRes.ok ? (await versionRes.text()).trim() : null;
    const s = data.server_state ?? {};
    const downloads: Download[] = [];
    for (const [hash, t] of Object.entries(data.torrents ?? {})) downloads.push(this.toDownload(hash, t));
    return {
      status: {
        version,
        downloadSpeed: s.dl_info_speed ?? 0,
        uploadSpeed: s.up_info_speed ?? 0,
        freeSpace: typeof s.free_space_on_disk === "number" && s.free_space_on_disk >= 0 ? s.free_space_on_disk : null,
        remainingBytes: downloads.reduce((sum, d) => sum + (d.state === "downloading" || d.state === "queued" || d.state === "paused" ? Math.max(0, d.size - d.downloaded) : 0), 0),
        limits: { download: s.dl_rate_limit ?? 0, upload: s.up_rate_limit ?? 0, altEnabled: Boolean(s.use_alt_speed_limits) },
        paused: false,
      },
      downloads,
      categories: Object.keys(data.categories ?? {}).sort(),
    };
  }

  private toDownload(hash: string, t: Partial<QbTorrent>): Download {
    const { state, error } = mapQbState(t.state ?? "unknown");
    const size = t.size ?? t.total_size ?? 0;
    const downloaded = typeof t.downloaded === "number" ? Math.min(t.downloaded, size || Infinity) : Math.round((t.progress ?? 0) * size);
    const eta = typeof t.eta === "number" && t.eta >= 0 && t.eta < INFINITE_ETA && state === "downloading" ? t.eta : null;
    return {
      id: `${this.providerId}:${hash}`,
      providerId: this.providerId,
      nativeId: hash,
      name: t.name ?? hash,
      state,
      progress: Math.max(0, Math.min(1, t.progress ?? 0)),
      size,
      downloaded,
      downloadSpeed: t.dlspeed ?? 0,
      uploadSpeed: t.upspeed ?? 0,
      eta,
      category: t.category || null,
      savePath: t.save_path ?? null,
      addedAt: t.added_on ? t.added_on * 1000 : null,
      completedAt: t.completion_on && t.completion_on > 0 ? t.completion_on * 1000 : null,
      error,
      torrent: { ratio: t.ratio ?? 0, seedingTime: t.seeding_time ?? 0, peers: t.num_leechs ?? 0, seeds: t.num_seeds ?? 0 },
    };
  }

  async add(req: AddRequest): Promise<void> {
    const body = new FormData();
    if (req.urls?.length) body.set("urls", req.urls.join("\n"));
    for (const f of req.files ?? []) body.append("torrents", new Blob([new Uint8Array(f.data)], { type: "application/x-bittorrent" }), f.name);
    if (req.category) body.set("category", req.category);
    if (req.paused) {
      body.set("paused", "true");
      body.set("stopped", "true");
    }
    const res = await this.request("/api/v2/torrents/add", { method: "POST", body });
    const text = (await res.text()).trim();
    if (res.status === 409) throw new ProviderError("qBittorrent already has this torrent", 409);
    if (res.status === 415) throw new ProviderError("qBittorrent could not parse that as a torrent or magnet link", 415);
    if (!res.ok || text === "Fails.") throw new ProviderError(`qBittorrent did not accept the torrent${text && text !== "Fails." ? `: ${text}` : ""}`, res.status);
  }

  /** pause/resume on 4.x, stop/start on 5.x; detect once and remember. */
  private async verb(modern: "stop" | "start", legacy: "pause" | "resume", hashes: string[]): Promise<void> {
    const fields = { hashes: hashes.join("|") };
    if (this.legacyVerbs !== true) {
      const res = await this.request(`/api/v2/torrents/${modern}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields).toString(),
      });
      if (res.ok) {
        this.legacyVerbs = false;
        return;
      }
      if (res.status !== 404) throw new ProviderError(`qBittorrent ${modern} failed: ${res.status}`, res.status);
      this.legacyVerbs = true;
    }
    await this.form(`/api/v2/torrents/${legacy}`, fields);
  }

  pause(ids: string[]) {
    return this.verb("stop", "pause", ids);
  }
  resume(ids: string[]) {
    return this.verb("start", "resume", ids);
  }
  async remove(ids: string[], deleteFiles: boolean) {
    await this.form("/api/v2/torrents/delete", { hashes: ids.join("|"), deleteFiles: String(deleteFiles) });
  }
  async moveToTop(ids: string[]) {
    await this.form("/api/v2/torrents/topPrio", { hashes: ids.join("|") });
  }
  async moveToBottom(ids: string[]) {
    await this.form("/api/v2/torrents/bottomPrio", { hashes: ids.join("|") });
  }
  async retry(ids: string[]) {
    await this.form("/api/v2/torrents/recheck", { hashes: ids.join("|") });
    await this.resume(ids);
  }
  async setCategory(ids: string[], category: string) {
    await this.form("/api/v2/torrents/setCategory", { hashes: ids.join("|"), category });
  }
  async setSpeedLimits(limits: Partial<SpeedLimits>) {
    if (typeof limits.download === "number") await this.form("/api/v2/transfer/setDownloadLimit", { limit: String(Math.max(0, Math.round(limits.download))) });
    if (typeof limits.upload === "number") await this.form("/api/v2/transfer/setUploadLimit", { limit: String(Math.max(0, Math.round(limits.upload))) });
    if (typeof limits.altEnabled === "boolean") {
      const res = await this.request("/api/v2/transfer/speedLimitsMode");
      const current = (await res.text()).trim() === "1";
      if (current !== limits.altEnabled) await this.form("/api/v2/transfer/toggleSpeedLimitsMode", {});
    }
  }
  async pauseAll() {
    await this.verb("stop", "pause", ["all"]);
  }
  async resumeAll() {
    await this.verb("start", "resume", ["all"]);
  }
  async files(id: string): Promise<DownloadFile[]> {
    const rows = await this.json<{ name: string; size: number; progress: number }[]>(`/api/v2/torrents/files?hash=${encodeURIComponent(id)}`);
    return rows.map((r) => ({ name: r.name, size: r.size, progress: r.progress }));
  }
}
