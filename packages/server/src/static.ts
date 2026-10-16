import fs from "node:fs";
import path from "node:path";
import type { Context } from "hono";
import type { AppContext } from "./context.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

/**
 * Serves the built client. index.html is rewritten on the fly so the SPA knows its base path:
 * a <base href> makes relative asset URLs resolve under BASE_PATH, and window.__DELIVERATOR__
 * carries the base path to the router and API client.
 */
export function createStaticHandler(ctx: AppContext) {
  const dir = ctx.config.clientDir;
  if (!dir) return null;
  const base = ctx.config.basePath;
  const rawIndex = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const bootstrap = `<base href="${base}/"><script>window.__DELIVERATOR__=${JSON.stringify({ basePath: base, version: ctx.version })}</script>`;
  const index = rawIndex.replace("<head>", `<head>${bootstrap}`);

  return (c: Context) => {
    const url = new URL(c.req.url);
    let rel = url.pathname;
    if (base) {
      if (rel === base) return c.redirect(base + "/");
      if (!rel.startsWith(base + "/")) return c.notFound();
      rel = rel.slice(base.length);
    }
    rel = decodeURIComponent(rel);
    const file = path.resolve(dir, "." + rel);
    if (file.startsWith(dir + path.sep) && rel !== "/" && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file).toLowerCase();
      const immutable = rel.startsWith("/assets/");
      return new Response(fs.readFileSync(file), {
        headers: {
          "content-type": MIME[ext] ?? "application/octet-stream",
          "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
        },
      });
    }
    // SPA fallback: every other path renders the app shell.
    return c.html(index, 200, { "cache-control": "no-cache" });
  };
}
