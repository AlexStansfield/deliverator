import { Hono, type Context } from "hono";

/**
 * A small in-memory imitation of the qBittorrent WebUI API v2, enough for Deliverator's
 * adapter: login cookie, maindata, add, stop/start, delete, prio, categories, files, limits.
 * Used by the adapter tests and by `pnpm mock` for local development.
 */
export interface MockTorrent {
  hash: string;
  name: string;
  state: string;
  progress: number;
  size: number;
  dlspeed: number;
  upspeed: number;
  category: string;
  save_path: string;
  added_on: number;
  completion_on: number;
  ratio: number;
  seeding_time: number;
  num_seeds: number;
  num_leechs: number;
  files: { name: string; size: number; progress: number }[];
}

export interface MockQbOptions {
  username?: string;
  password?: string;
  /** "5.0.2" uses stop/start; anything < 5 uses pause/resume */
  version?: string;
  torrents?: MockTorrent[];
}

const hashOf = (seed: string) => Array.from({ length: 40 }, (_, i) => "0123456789abcdef"[(seed.charCodeAt(i % seed.length) * (i + 7)) % 16]).join("");

export function sampleTorrents(now = Date.now()): MockTorrent[] {
  const s = Math.floor(now / 1000);
  const mk = (name: string, state: string, progress: number, size: number, extra: Partial<MockTorrent> = {}): MockTorrent => ({
    hash: hashOf(name),
    name,
    state,
    progress,
    size,
    dlspeed: 0,
    upspeed: 0,
    category: "",
    save_path: "/downloads",
    added_on: s - 3600,
    completion_on: progress >= 1 ? s - 600 : 0,
    ratio: 0,
    seeding_time: 0,
    num_seeds: 0,
    num_leechs: 0,
    files: [{ name, size, progress }],
    ...extra,
  });
  return [
    mk("ubuntu-24.04.1-desktop-amd64.iso", "downloading", 0.62, 5_800_000_000, { dlspeed: 6_200_000, upspeed: 420_000, category: "linux-isos", save_path: "/downloads/iso", added_on: s - 120, num_seeds: 42, num_leechs: 118, ratio: 0.11, files: [{ name: "ubuntu-24.04.1-desktop-amd64.iso", size: 5_800_000_000, progress: 0.62 }, { name: "SHA256SUMS", size: 1200, progress: 1 }] }),
    mk("Fedora-Workstation-Live-x86_64-41-1.4.iso", "stoppedDL", 0.12, 2_300_000_000, { category: "linux-isos" }),
    mk("Big Buck Bunny (2008) 4K 60fps", "uploading", 1, 1_900_000_000, { upspeed: 740_000, category: "movies", ratio: 1.84, seeding_time: 266_000, num_seeds: 12, num_leechs: 3, added_on: s - 3 * 86400 }),
    mk("2026-10-01-raspios-bookworm-arm64.img.xz", "queuedDL", 0, 1_100_000_000, { category: "linux-isos", added_on: s - 1500 }),
    mk("Sintel (2010) 1080p", "stoppedUP", 1, 1_100_000_000, { category: "movies", ratio: 2.4, seeding_time: 400_000, added_on: s - 86400 }),
    mk("Tears of Steel (2012) 4K", "missingFiles", 0.82, 4_100_000_000, { category: "movies", added_on: s - 7200 }),
  ];
}

export function createQbMock(opts: MockQbOptions = {}) {
  const username = opts.username ?? "admin";
  const password = opts.password ?? "adminadmin";
  const version = opts.version ?? "v5.0.2";
  const modern = Number.parseInt(version.replace(/^v/, ""), 10) >= 5;
  const [vMajor = 0, vMinor = 0] = version.replace(/^v/, "").split(".").map(Number);
  /** 5.2+ answers 204 with a QBT_SID_<port> cookie and 401 on bad credentials. */
  const newLogin = vMajor > 5 || (vMajor === 5 && vMinor >= 2);
  const state = {
    torrents: opts.torrents ?? sampleTorrents(),
    categories: new Set(["linux-isos", "movies", "tv"]),
    dlLimit: 0,
    ulLimit: 0,
    altMode: false,
    sid: "mock-sid-" + Math.random().toString(36).slice(2),
    calls: [] as { path: string; body: Record<string, string> }[],
  };
  for (const t of state.torrents) if (t.category) state.categories.add(t.category);

  const app = new Hono();
  const authed = (cookie: string | undefined) => cookie?.includes(`SID_8080=${state.sid}`) || cookie?.includes(`SID=${state.sid}`);

  app.post("/api/v2/auth/login", async (c) => {
    const body = await c.req.parseBody();
    if (body.username !== username || body.password !== password) return newLogin ? c.text("Unauthorized", 401) : c.text("Fails.", 200);
    if (newLogin) {
      c.header("set-cookie", `QBT_SID_8080=${state.sid}; HttpOnly; SameSite=Lax; path=/`);
      return c.body(null, 204);
    }
    c.header("set-cookie", `SID=${state.sid}; HttpOnly; path=/`);
    return c.text("Ok.");
  });
  app.use("/api/v2/*", async (c, next) => {
    if (c.req.path.endsWith("/auth/login")) return next();
    if (!authed(c.req.header("cookie"))) return c.text("Forbidden", 403);
    await next();
  });
  app.get("/api/v2/app/version", (c) => c.text(version));
  app.get("/api/v2/sync/maindata", (c) => {
    const torrents: Record<string, Omit<MockTorrent, "files" | "hash">> = {};
    for (const t of state.torrents) {
      const { files: _f, hash: _h, ...rest } = t;
      torrents[t.hash] = { ...rest, downloaded: Math.round(t.progress * t.size), eta: t.dlspeed > 0 ? Math.round(((1 - t.progress) * t.size) / t.dlspeed) : 8640000 } as never;
    }
    const categories: Record<string, { name: string; savePath: string }> = {};
    for (const cat of state.categories) categories[cat] = { name: cat, savePath: "" };
    return c.json({
      rid: 1,
      full_update: true,
      torrents,
      categories,
      server_state: {
        dl_info_speed: state.torrents.reduce((s, t) => s + t.dlspeed, 0),
        up_info_speed: state.torrents.reduce((s, t) => s + t.upspeed, 0),
        dl_rate_limit: state.altMode ? 10240 : state.dlLimit,
        up_rate_limit: state.altMode ? 10240 : state.ulLimit,
        use_alt_speed_limits: state.altMode,
        free_space_on_disk: 68_500_000_000,
      },
    });
  });
  const record = async (c: Context) => {
    const body = (await c.req.parseBody()) as Record<string, string>;
    state.calls.push({ path: c.req.path, body });
    return body;
  };
  const hashesOf = (body: Record<string, string>) => (body.hashes === "all" ? state.torrents.map((t) => t.hash) : (body.hashes ?? "").split("|"));

  app.post("/api/v2/torrents/add", async (c) => {
    const body = await record(c);
    const urls = String(body.urls ?? "").split("\n").filter(Boolean);
    const files = Object.entries(body).filter(([k]) => k.startsWith("torrents")).map(([, v]) => v);
    if (urls.length === 0 && files.length === 0) return c.text("Fails.", 415);
    const now = Math.floor(Date.now() / 1000);
    const paused = body.paused === "true" || body.stopped === "true";
    for (const u of urls) {
      const name = u.match(/dn=([^&]+)/)?.[1] ? decodeURIComponent(u.match(/dn=([^&]+)/)![1]!) : u.split("/").pop() || "torrent";
      state.torrents.push({ hash: hashOf(u), name, state: paused ? "stoppedDL" : "downloading", progress: 0, size: 700_000_000, dlspeed: paused ? 0 : 1_500_000, upspeed: 0, category: String(body.category ?? ""), save_path: "/downloads", added_on: now, completion_on: 0, ratio: 0, seeding_time: 0, num_seeds: 5, num_leechs: 2, files: [{ name, size: 700_000_000, progress: 0 }] });
    }
    for (const f of files) {
      const name = (f as unknown as File).name?.replace(/\.torrent$/, "") || "upload";
      state.torrents.push({ hash: hashOf(name), name, state: paused ? "stoppedDL" : "downloading", progress: 0, size: 300_000_000, dlspeed: 0, upspeed: 0, category: String(body.category ?? ""), save_path: "/downloads", added_on: now, completion_on: 0, ratio: 0, seeding_time: 0, num_seeds: 0, num_leechs: 0, files: [{ name, size: 300_000_000, progress: 0 }] });
    }
    return c.text("Ok.");
  });
  const setState = (hashes: string[], fn: (t: MockTorrent) => void) => state.torrents.filter((t) => hashes.includes(t.hash)).forEach(fn);
  const stop = async (c: Context) => {
    const body = await record(c);
    setState(hashesOf(body), (t) => {
      t.state = t.progress >= 1 ? "stoppedUP" : "stoppedDL";
      t.dlspeed = 0;
      t.upspeed = 0;
    });
    return c.text("");
  };
  const start = async (c: Context) => {
    const body = await record(c);
    setState(hashesOf(body), (t) => {
      t.state = t.progress >= 1 ? "uploading" : "downloading";
      if (t.progress < 1) t.dlspeed = 2_000_000;
    });
    return c.text("");
  };
  if (modern) {
    app.post("/api/v2/torrents/stop", stop);
    app.post("/api/v2/torrents/start", start);
  } else {
    app.post("/api/v2/torrents/pause", stop);
    app.post("/api/v2/torrents/resume", start);
  }
  app.post("/api/v2/torrents/delete", async (c) => {
    const body = await record(c);
    const hashes = hashesOf(body);
    state.torrents = state.torrents.filter((t) => !hashes.includes(t.hash));
    return c.text("");
  });
  app.post("/api/v2/torrents/topPrio", async (c) => {
    const body = await record(c);
    const hashes = hashesOf(body);
    state.torrents = [...state.torrents.filter((t) => hashes.includes(t.hash)), ...state.torrents.filter((t) => !hashes.includes(t.hash))];
    return c.text("");
  });
  app.post("/api/v2/torrents/bottomPrio", async (c) => {
    const body = await record(c);
    const hashes = hashesOf(body);
    state.torrents = [...state.torrents.filter((t) => !hashes.includes(t.hash)), ...state.torrents.filter((t) => hashes.includes(t.hash))];
    return c.text("");
  });
  app.post("/api/v2/torrents/recheck", async (c) => {
    const body = await record(c);
    setState(hashesOf(body), (t) => (t.state = "checkingDL"));
    return c.text("");
  });
  app.post("/api/v2/torrents/setCategory", async (c) => {
    const body = await record(c);
    setState(hashesOf(body), (t) => (t.category = body.category ?? ""));
    state.categories.add(body.category ?? "");
    return c.text("");
  });
  app.get("/api/v2/torrents/files", (c) => {
    const t = state.torrents.find((x) => x.hash === c.req.query("hash"));
    return t ? c.json(t.files.map((f, i) => ({ index: i, ...f, priority: 1 }))) : c.text("Not Found", 404);
  });
  app.post("/api/v2/transfer/setDownloadLimit", async (c) => {
    const body = await record(c);
    state.dlLimit = Number(body.limit);
    return c.text("");
  });
  app.post("/api/v2/transfer/setUploadLimit", async (c) => {
    const body = await record(c);
    state.ulLimit = Number(body.limit);
    return c.text("");
  });
  app.get("/api/v2/transfer/speedLimitsMode", (c) => c.text(state.altMode ? "1" : "0"));
  app.post("/api/v2/transfer/toggleSpeedLimitsMode", async (c) => {
    await record(c);
    state.altMode = !state.altMode;
    return c.text("");
  });

  /** Advance simulated downloads by `seconds`. */
  function advance(seconds: number) {
    for (const t of state.torrents) {
      if (t.state === "downloading" && t.dlspeed > 0) {
        t.progress = Math.min(1, t.progress + (t.dlspeed * seconds) / t.size);
        t.files.forEach((f) => (f.progress = t.progress));
        if (t.progress >= 1) {
          t.state = "uploading";
          t.dlspeed = 0;
          t.upspeed = 300_000;
          t.completion_on = Math.floor(Date.now() / 1000);
        }
      } else if (t.state === "checkingDL") {
        t.state = "downloading";
        t.dlspeed = 1_000_000;
      }
    }
  }

  return { app, state, advance, fetch: ((url: string | URL | Request, init?: RequestInit) => app.request(url instanceof Request ? url : String(url), init)) as typeof fetch };
}
