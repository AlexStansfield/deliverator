import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../context.js";
import { resolveSession, SESSION_COOKIE } from "./session.js";

/** Rejects with 401 unless a valid session cookie is present. Sets `user` and `sessionToken`. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  const row = token ? resolveSession(c.get("ctx").db, token) : null;
  if (!row || !token) {
    return c.json({ error: "Not signed in" }, 401);
  }
  c.set("user", row.user);
  c.set("sessionToken", token);
  await next();
};
