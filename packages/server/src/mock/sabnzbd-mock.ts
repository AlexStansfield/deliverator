import { Hono, type Context } from "hono";

/** In-memory imitation of the SABnzbd JSON API used by the adapter tests and `pnpm mock`. */
export interface MockNzb {
  nzo_id: string;
  name: string;
  /** queue status (Downloading/Paused/Queued) or history status (Completed/Failed/Repairing/Extracting/...) */
  status: string;
  inQueue: boolean;
  mb: number;
  mbleft: number;
  cat: string;
  completed: number;
  fail_message?: string;
  files: { filename: string; mb: number; mbleft: number }[];
}

export interface MockSabOptions {
  apiKey?: string;
  version?: string;
  items?: MockNzb[];
}

export function sampleNzbs(now = Date.now()): MockNzb[] {
  const s = Math.floor(now / 1000);
  const mk = (id: string, name: string, status: string, inQueue: boolean, mb: number, mbleft: number, extra: Partial<MockNzb> = {}): MockNzb => ({
    nzo_id: `SABnzbd_nzo_${id}`,
    name,
    status,
    inQueue,
    mb,
    mbleft,
    cat: "*",
    completed: 0,
    files: [{ filename: `${name}.part01.rar`, mb: mb / 2, mbleft: Math.max(0, mbleft - mb / 2) }, { filename: `${name}.part02.rar`, mb: mb / 2, mbleft: Math.min(mbleft, mb / 2) }],
    ...extra,
  });
  return [
    mk("a1", "linuxmint-22-cinnamon-64bit.iso", "Downloading", true, 2900, 1800, { cat: "iso" }),
    mk("b2", "archlinux-2026.10.01-x86_64.iso", "Queued", true, 1200, 1200, { cat: "iso" }),
    mk("c3", "debian-12.7.0-amd64-netinst.iso", "Repairing", false, 658, 0, { cat: "iso" }),
    mk("d4", "Sintel (2010) 1080p", "Completed", false, 1100, 0, { cat: "movies", completed: s - 86400 }),
    mk("e5", "Tears of Steel (2012) 4K", "Failed", false, 4100, 0, { cat: "movies", completed: s - 7200, fail_message: "Download failed - Not on your server(s). Too many missing articles" }),
  ];
}

export function createSabMock(opts: MockSabOptions = {}) {
  const apiKey = opts.apiKey ?? "mock-api-key";
  const version = opts.version ?? "4.3.3";
  const state = {
    items: opts.items ?? sampleNzbs(),
    paused: false,
    speedLimitPct: 100,
    speedLimitAbs: 0,
    kbpersec: 4300,
    categories: ["*", "iso", "movies", "tv"],
    calls: [] as Record<string, string>[],
  };
  const app = new Hono();

  const handle = async (c: Context) => {
    const q = Object.fromEntries(new URL(c.req.url).searchParams) as Record<string, string>;
    state.calls.push(q);
    if (q.apikey !== apiKey && q.mode !== "version") return c.json({ status: false, error: "API Key Incorrect" });
    const mb = (n: number) => n.toFixed(2);
    switch (q.mode) {
      case "version":
        return c.json({ version });
      case "queue": {
        if (q.name === "pause") {
          state.items.filter((i) => q.value!.split(",").includes(i.nzo_id)).forEach((i) => (i.status = "Paused"));
          return c.json({ status: true });
        }
        if (q.name === "resume") {
          state.items.filter((i) => q.value!.split(",").includes(i.nzo_id)).forEach((i) => (i.status = i.mbleft < i.mb ? "Downloading" : "Queued"));
          return c.json({ status: true });
        }
        if (q.name === "delete") {
          const ids = q.value!.split(",");
          const hit = state.items.filter((i) => i.inQueue && ids.includes(i.nzo_id)).map((i) => i.nzo_id);
          state.items = state.items.filter((i) => !(i.inQueue && ids.includes(i.nzo_id)));
          return c.json({ status: hit.length > 0, nzo_ids: hit });
        }
        if (q.name === "change_cat") {
          state.items.filter((i) => q.value!.split(",").includes(i.nzo_id)).forEach((i) => (i.cat = q.value2 ?? "*"));
          return c.json({ status: true });
        }
        const queue = state.items.filter((i) => i.inQueue);
        const active = queue.find((i) => i.status === "Downloading");
        const speed = state.paused ? 0 : state.kbpersec;
        return c.json({
          queue: {
            version,
            paused: state.paused,
            kbpersec: mb(speed),
            speed: `${mb(speed / 1024)} M`,
            speedlimit: String(state.speedLimitPct),
            speedlimit_abs: String(state.speedLimitAbs),
            diskspace1: "63.82",
            diskspacetotal1: "500.00",
            mbleft: mb(queue.reduce((s, i) => s + i.mbleft, 0)),
            mb: mb(queue.reduce((s, i) => s + i.mb, 0)),
            status: state.paused ? "Paused" : active ? "Downloading" : "Idle",
            slots: queue.map((i, index) => ({
              nzo_id: i.nzo_id,
              filename: i.name,
              status: state.paused && i.status === "Downloading" ? "Downloading" : i.status,
              mb: mb(i.mb),
              mbleft: mb(i.mbleft),
              percentage: String(Math.round(((i.mb - i.mbleft) / i.mb) * 100)),
              timeleft: i.status === "Downloading" && speed > 0 ? secs((i.mbleft * 1024) / speed) : "0:00:00",
              cat: i.cat,
              index,
              priority: "Normal",
            })),
          },
        });
      }
      case "history": {
        if (q.name === "delete") {
          const ids = q.value!.split(",");
          const hit = state.items.some((i) => !i.inQueue && ids.includes(i.nzo_id));
          state.items = state.items.filter((i) => !(!i.inQueue && ids.includes(i.nzo_id)));
          return c.json({ status: hit });
        }
        return c.json({
          history: {
            slots: state.items
              .filter((i) => !i.inQueue)
              .map((i) => ({
                nzo_id: i.nzo_id,
                name: i.name,
                status: i.status,
                fail_message: i.fail_message ?? "",
                bytes: Math.round(i.mb * 1024 * 1024),
                size: `${mb(i.mb)} MB`,
                category: i.cat,
                completed: i.completed,
                storage: i.status === "Completed" ? `/downloads/complete/${i.cat === "*" ? "" : i.cat + "/"}${i.name}` : "",
                action_line: i.status === "Repairing" ? "Repairing: 91%" : "",
              })),
          },
        });
      }
      case "get_cats":
        return c.json({ categories: state.categories });
      case "get_files": {
        const item = state.items.find((i) => i.nzo_id === q.value);
        return c.json({ files: item?.files.map((f) => ({ filename: f.filename, mb: mb(f.mb), mbleft: mb(f.mbleft), bytes: String(Math.round(f.mb * 1024 * 1024)) })) ?? [] });
      }
      case "addurl": {
        if (!q.name) return c.json({ status: false, error: "expect one parameter" });
        const id = `SABnzbd_nzo_${Math.random().toString(36).slice(2, 8)}`;
        const name = q.name.split("/").pop()?.replace(/\.nzb$/i, "") || "nzb";
        state.items.push({ nzo_id: id, name, status: q.priority === "-2" ? "Paused" : "Queued", inQueue: true, mb: 900, mbleft: 900, cat: q.cat ?? "*", completed: 0, files: [{ filename: name, mb: 900, mbleft: 900 }] });
        return c.json({ status: true, nzo_ids: [id] });
      }
      case "addfile": {
        const form = await c.req.formData().catch(() => null);
        const file = form?.get("nzbfile");
        if (!(file instanceof File)) return c.json({ status: false, error: "no file" });
        const id = `SABnzbd_nzo_${Math.random().toString(36).slice(2, 8)}`;
        const name = file.name.replace(/\.nzb$/i, "");
        state.items.push({ nzo_id: id, name, status: q.priority === "-2" ? "Paused" : "Queued", inQueue: true, mb: 400, mbleft: 400, cat: q.cat ?? "*", completed: 0, files: [{ filename: name, mb: 400, mbleft: 400 }] });
        return c.json({ status: true, nzo_ids: [id] });
      }
      case "switch": {
        const idx = state.items.findIndex((i) => i.nzo_id === q.value);
        if (idx >= 0) {
          const [item] = state.items.splice(idx, 1);
          const queue = state.items.filter((i) => i.inQueue);
          const target = Math.min(Number(q.value2), queue.length);
          const insertAt = target >= queue.length ? state.items.length : state.items.indexOf(queue[target]!);
          state.items.splice(insertAt, 0, item!);
        }
        return c.json({ status: true, position: Number(q.value2) });
      }
      case "retry": {
        const item = state.items.find((i) => i.nzo_id === q.value);
        if (item) {
          item.inQueue = true;
          item.status = "Queued";
          item.mbleft = item.mb;
          item.fail_message = undefined;
        }
        return c.json({ status: true });
      }
      case "change_cat":
        state.items.filter((i) => q.value!.split(",").includes(i.nzo_id)).forEach((i) => (i.cat = q.value2 ?? "*"));
        return c.json({ status: true });
      case "config":
        if (q.name === "speedlimit") {
          const v = q.value ?? "0";
          if (/k$/i.test(v)) {
            state.speedLimitAbs = Number.parseInt(v, 10) * 1024;
            state.speedLimitPct = 50;
          } else if (/m$/i.test(v)) {
            state.speedLimitAbs = Number.parseInt(v, 10) * 1024 * 1024;
            state.speedLimitPct = 50;
          } else {
            state.speedLimitPct = Number(v) || 100;
            state.speedLimitAbs = 0;
          }
          return c.json({ status: true, value: v });
        }
        return c.json({ status: false, error: "unsupported config" });
      case "pause":
        state.paused = true;
        return c.json({ status: true });
      case "resume":
        state.paused = false;
        return c.json({ status: true });
      default:
        return c.json({ status: false, error: `unknown mode ${q.mode}` });
    }
  };
  app.get("/api", handle);
  app.post("/api", handle);

  function advance(seconds: number) {
    if (state.paused) return;
    const active = state.items.find((i) => i.inQueue && i.status === "Downloading");
    if (!active) {
      const next = state.items.find((i) => i.inQueue && i.status === "Queued");
      if (next) next.status = "Downloading";
      return;
    }
    active.mbleft = Math.max(0, active.mbleft - (state.kbpersec * seconds) / 1024);
    let left = active.mbleft;
    for (const f of [...active.files].reverse()) {
      f.mbleft = Math.min(f.mb, left);
      left = Math.max(0, left - f.mb);
    }
    if (active.mbleft <= 0) {
      active.inQueue = false;
      active.status = "Completed";
      active.completed = Math.floor(Date.now() / 1000);
    }
  }

  return { app, state, advance, fetch: ((url: string | URL | Request, init?: RequestInit) => app.request(url instanceof Request ? url : String(url), init)) as typeof fetch };
}

function secs(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
