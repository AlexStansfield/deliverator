import { describe, it, expect, beforeEach } from "vitest";
import { createApp, type App } from "../app.js";
import { testContext, cookieFrom } from "../test/helpers.js";
import { ensureAdminUser } from "../auth/bootstrap.js";
import type { AppContext } from "../context.js";
import { createQbMock } from "../mock/qbittorrent-mock.js";
import { createSabMock } from "../mock/sabnzbd-mock.js";
import type { StateSnapshot, AddDownloadResult, ProviderSummary } from "@deliverator/shared";

describe("providers and downloads API", () => {
  let ctx: AppContext;
  let app: App;
  let cookie: string;
  let qb: ReturnType<typeof createQbMock>;
  let sab: ReturnType<typeof createSabMock>;

  const post = (path: string, body: unknown, method = "POST") =>
    app.request(path, { method, headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });

  beforeEach(async () => {
    qb = createQbMock();
    sab = createSabMock();
    const routed: typeof fetch = (url, init) => {
      const u = String(url instanceof Request ? url.url : url);
      return u.startsWith("http://qb.local") ? qb.fetch(url, init) : sab.fetch(url, init);
    };
    ctx = testContext({}, { fetch: routed });
    const password = ensureAdminUser(ctx.db)!.password;
    app = createApp(ctx);
    const login = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password }) });
    cookie = cookieFrom(login);
  });

  it("tests a connection before saving", async () => {
    const ok = await post("/api/providers/test", { type: "qbittorrent", name: "QB", url: "http://qb.local:8080", username: "admin", password: "adminadmin" });
    expect(await ok.json()).toEqual({ ok: true, version: "v5.0.2" });
    const bad = await post("/api/providers/test", { type: "sabnzbd", name: "SAB", url: "http://sab.local", apiKey: "wrong" });
    expect(await bad.json()).toMatchObject({ ok: false });
    const missing = await post("/api/providers/test", { type: "sabnzbd", name: "SAB", url: "http://sab.local" });
    expect(missing.status).toBe(400);
  });

  it("creates providers, polls them and serves a merged state", async () => {
    const a = await post("/api/providers", { type: "qbittorrent", name: "Dixie qB", url: "http://qb.local:8080/", username: "admin", password: "adminadmin" });
    expect(a.status).toBe(201);
    const qbSummary = (await a.json()) as ProviderSummary;
    expect(qbSummary.url).toBe("http://qb.local:8080");
    const b = await post("/api/providers", { type: "sabnzbd", name: "Dixie SAB", url: "http://sab.local", apiKey: "mock-api-key" });
    expect(b.status).toBe(201);

    await ctx.providers["tick"]();
    const state = (await (await app.request("/api/state", { headers: { cookie } })).json()) as StateSnapshot;
    expect(state.providers).toHaveLength(2);
    expect(state.statuses.every((s) => s.connected)).toBe(true);
    expect(state.downloads.length).toBe(qb.state.torrents.length + sab.state.items.length);
    expect(state.providers[0]!.categories).toEqual(["linux-isos", "movies", "tv"]);

    // Editing with a blank password keeps the stored one.
    const upd = await post(`/api/providers/${qbSummary.id}`, { type: "qbittorrent", name: "Renamed", url: "http://qb.local:8080", username: "admin", password: "" }, "PUT");
    expect(upd.status).toBe(200);
    await ctx.providers["tick"]();
    expect(ctx.providers.getSnapshot().statuses.find((s) => s.providerId === qbSummary.id)?.connected).toBe(true);
  });

  it("routes added links to the right provider and applies actions", async () => {
    await post("/api/providers", { type: "qbittorrent", name: "QB", url: "http://qb.local:8080", username: "admin", password: "adminadmin" });
    await post("/api/providers", { type: "sabnzbd", name: "SAB", url: "http://sab.local", apiKey: "mock-api-key" });
    await ctx.providers["tick"]();

    const res = await post("/api/downloads", { urls: ["magnet:?xt=urn:btih:abc&dn=hello.iso", "https://indexer.example/get/1/thing.nzb", "https://example.com/mystery"] });
    const result = (await res.json()) as AddDownloadResult;
    expect(result.added).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.reason).toMatch(/Pick a provider/);

    await ctx.providers["tick"]();
    const state = ctx.providers.getSnapshot();
    const hello = state.downloads.find((d) => d.name === "hello.iso")!;
    const thing = state.downloads.find((d) => d.name === "thing")!;
    expect(hello).toBeDefined();
    expect(thing).toBeDefined();

    const act = await post("/api/downloads/actions", { ids: [hello.id, thing.id], action: "pause" });
    expect(act.status).toBe(200);
    expect(qb.state.torrents.find((t) => t.name === "hello.iso")?.state).toBe("stoppedDL");
    expect(sab.state.items.find((i) => i.name === "thing")?.status).toBe("Paused");

    const files = await app.request(`/api/downloads/${hello.id}/files`, { headers: { cookie } });
    expect(((await files.json()) as { files: unknown[] }).files).toHaveLength(1);

    const del = await post("/api/downloads/actions", { ids: [hello.id], action: "delete", deleteFiles: true });
    expect(del.status).toBe(200);
    expect(qb.state.torrents.some((t) => t.name === "hello.iso")).toBe(false);
  });

  it("sets limits and pauses a whole provider", async () => {
    const a = (await (await post("/api/providers", { type: "sabnzbd", name: "SAB", url: "http://sab.local", apiKey: "mock-api-key" })).json()) as ProviderSummary;
    const lim = await post(`/api/providers/${a.id}/limits`, { download: 2 * 1024 * 1024 });
    expect(lim.status).toBe(200);
    expect(sab.state.speedLimitAbs).toBe(2 * 1024 * 1024);
    await post(`/api/providers/${a.id}/pause`, {});
    expect(sab.state.paused).toBe(true);
    await post(`/api/providers/${a.id}/resume`, {});
    expect(sab.state.paused).toBe(false);
    const gone = await app.request(`/api/providers/${a.id}`, { method: "DELETE", headers: { cookie } });
    expect(gone.status).toBe(200);
    expect(ctx.providers.list()).toHaveLength(0);
  });

  it("streams state over SSE", async () => {
    const res = await app.request("/api/events", { headers: { cookie } });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: state");
    expect(text).toContain('"downloads":[]');
    await reader.cancel();
  });
});
