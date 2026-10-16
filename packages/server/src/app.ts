import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { AppInfo } from "@deliverator/shared";
import type { AppContext, AppEnv } from "./context.js";
import { authRoutes } from "./routes/auth.js";
import { settingsRoutes } from "./routes/settings.js";
import { resolveSession, SESSION_COOKIE } from "./auth/session.js";
import { createStaticHandler } from "./static.js";

export function createApp(ctx: AppContext) {
  const app = new Hono<AppEnv>().basePath(ctx.config.basePath || "/");

  app.use("*", async (c, next) => {
    c.set("ctx", ctx);
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    ctx.log.error(`${c.req.method} ${c.req.path} failed: ${err.message}`, ctx.config.logLevel === "debug" ? err : undefined);
    return c.json({ error: err.message || "Internal error" }, 500);
  });

  const api = new Hono<AppEnv>()
    .get("/info", (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      const info: AppInfo = {
        name: "Deliverator",
        version: ctx.version,
        basePath: ctx.config.basePath,
        authenticated: Boolean(token && resolveSession(ctx.db, token)),
      };
      return c.json(info);
    })
    .get("/health", (c) => c.json({ ok: true }))
    .route("/auth", authRoutes)
    .route("/settings", settingsRoutes)
    .notFound((c) => c.json({ error: "Not found" }, 404));

  app.route("/api", api);

  const serveClient = createStaticHandler(ctx);
  if (serveClient) {
    app.get("/*", serveClient);
  } else {
    app.get("/*", (c) =>
      c.text("Deliverator API is running. The web client is not built; run `pnpm build` or use the Vite dev server.", 200),
    );
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
