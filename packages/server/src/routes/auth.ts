import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../context.js";
import { schema } from "../db/index.js";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "../auth/password.js";
import { createSession, revokeOtherSessions, revokeSession, SESSION_COOKIE, SESSION_TTL_MS } from "../auth/session.js";
import { requireAuth } from "../auth/middleware.js";
import { isSecureRequest } from "../http.js";

/** Small in-memory brute-force guard: after 5 failures from one address, block for 60s. */
const failures = new Map<string, { count: number; blockedUntil: number }>();
const MAX_FAILURES = 5;
const BLOCK_MS = 60_000;

function clientKey(headers: Headers, fallback: string): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || fallback;
}

export const authRoutes = new Hono<AppEnv>()
  .post(
    "/login",
    zValidator("json", z.object({ username: z.string().min(1), password: z.string().min(1) })),
    (c) => {
      const { db, config } = c.get("ctx");
      const key = clientKey(c.req.raw.headers, "local");
      const entry = failures.get(key);
      if (entry && entry.blockedUntil > Date.now()) {
        return c.json({ error: "Too many failed attempts. Try again in a minute." }, 429);
      }
      const { username, password } = c.req.valid("json");
      const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
      if (!user || !verifyPassword(password, user.passwordHash)) {
        const next = { count: (entry?.count ?? 0) + 1, blockedUntil: 0 };
        if (next.count >= MAX_FAILURES) {
          next.blockedUntil = Date.now() + BLOCK_MS;
          next.count = 0;
        }
        failures.set(key, next);
        return c.json({ error: "Wrong username or password" }, 401);
      }
      failures.delete(key);
      const token = createSession(db, user.id, c.req.header("user-agent") ?? null);
      setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "Lax",
        secure: isSecureRequest(c.req.raw),
        path: config.basePath || "/",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return c.json({ user: { username: user.username } });
    },
  )
  .post("/logout", requireAuth, (c) => {
    const { db, config } = c.get("ctx");
    revokeSession(db, c.get("sessionToken"));
    deleteCookie(c, SESSION_COOKIE, { path: config.basePath || "/" });
    return c.json({ ok: true });
  })
  .get("/me", requireAuth, (c) => {
    const user = c.get("user");
    return c.json({ user: { username: user.username } });
  })
  .post(
    "/password",
    requireAuth,
    zValidator(
      "json",
      z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200) }),
    ),
    (c) => {
      const { db } = c.get("ctx");
      const user = c.get("user");
      const { currentPassword, newPassword } = c.req.valid("json");
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        return c.json({ error: "Current password is wrong" }, 400);
      }
      db.update(schema.users)
        .set({ passwordHash: hashPassword(newPassword), updatedAt: Date.now() })
        .where(eq(schema.users.id, user.id))
        .run();
      revokeOtherSessions(db, user.id, c.get("sessionToken"));
      return c.json({ ok: true });
    },
  );
