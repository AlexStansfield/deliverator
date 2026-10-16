import { describe, it, expect, beforeEach } from "vitest";
import { createApp, type App } from "./app.js";
import { testContext, cookieFrom } from "./test/helpers.js";
import { ensureAdminUser } from "./auth/bootstrap.js";
import type { AppContext } from "./context.js";

const json = (body: unknown, cookie?: string) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

describe("auth flow", () => {
  let ctx: AppContext;
  let app: App;
  let password: string;

  beforeEach(() => {
    ctx = testContext();
    password = ensureAdminUser(ctx.db)!.password;
    app = createApp(ctx);
  });

  it("creates the admin user only once", () => {
    expect(ensureAdminUser(ctx.db)).toBeNull();
  });

  it("reports unauthenticated info without a cookie", async () => {
    const res = await app.request("/api/info");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Deliverator", basePath: "", authenticated: false });
  });

  it("rejects protected routes without a session", async () => {
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("logs in, reads /me, changes password and logs out", async () => {
    const bad = await app.request("/api/auth/login", json({ username: "admin", password: "nope" }));
    expect(bad.status).toBe(401);

    const login = await app.request("/api/auth/login", json({ username: "admin", password }));
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("Path=/");

    const me = await app.request("/api/auth/me", { headers: { cookie } });
    expect(await me.json()).toEqual({ user: { username: "admin" } });

    const short = await app.request("/api/auth/password", json({ currentPassword: password, newPassword: "short" }, cookie));
    expect(short.status).toBe(400);

    const changed = await app.request(
      "/api/auth/password",
      json({ currentPassword: password, newPassword: "a-much-better-password" }, cookie),
    );
    expect(changed.status).toBe(200);

    const relogin = await app.request("/api/auth/login", json({ username: "admin", password: "a-much-better-password" }));
    expect(relogin.status).toBe(200);

    const logout = await app.request("/api/auth/logout", { method: "POST", headers: { cookie } });
    expect(logout.status).toBe(200);
    const after = await app.request("/api/auth/me", { headers: { cookie } });
    expect(after.status).toBe(401);
  });

  it("stores and returns preferences", async () => {
    const login = await app.request("/api/auth/login", json({ username: "admin", password }));
    const cookie = cookieFrom(login);
    const defaults = await app.request("/api/settings/preferences", { headers: { cookie } });
    expect(((await defaults.json()) as { theme: string }).theme).toBe("midnight");
    const put = await app.request("/api/settings/preferences", {
      ...json({ theme: "nord", refreshInterval: 1000, speedPresets: [1000], confirmDelete: false, deleteFilesByDefault: false }, cookie),
      method: "PUT",
    });
    expect(put.status).toBe(200);
    const again = await app.request("/api/settings/preferences", { headers: { cookie } });
    expect(((await again.json()) as { theme: string }).theme).toBe("nord");
  });
});

describe("base path", () => {
  it("mounts the API under BASE_PATH and scopes the cookie to it", async () => {
    const ctx = testContext({ basePath: "/downloader" });
    const password = ensureAdminUser(ctx.db)!.password;
    const app = createApp(ctx);

    expect((await app.request("/api/info")).status).toBe(404);
    const info = await app.request("/downloader/api/info");
    expect(info.status).toBe(200);
    expect(((await info.json()) as { basePath: string }).basePath).toBe("/downloader");

    const login = await app.request("/downloader/api/auth/login", json({ username: "admin", password }));
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("Path=/downloader");
  });
});
