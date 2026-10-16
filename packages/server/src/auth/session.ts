import { eq, lt, and, ne } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { randomToken, sha256 } from "../crypto.js";

export const SESSION_COOKIE = "deliverator_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export function createSession(db: Db, userId: string, userAgent: string | null): string {
  const token = randomToken(32);
  const now = Date.now();
  db.insert(schema.sessions)
    .values({ id: sha256(token), userId, createdAt: now, expiresAt: now + SESSION_TTL_MS, lastSeenAt: now, userAgent })
    .run();
  return token;
}

export function resolveSession(db: Db, token: string) {
  const id = sha256(token);
  const row = db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, id))
    .get();
  if (!row) return null;
  const now = Date.now();
  if (row.session.expiresAt <= now) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
    return null;
  }
  if (now - row.session.lastSeenAt > TOUCH_INTERVAL_MS) {
    db.update(schema.sessions)
      .set({ lastSeenAt: now, expiresAt: now + SESSION_TTL_MS })
      .where(eq(schema.sessions.id, id))
      .run();
  }
  return row;
}

export function revokeSession(db: Db, token: string) {
  db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).run();
}

/** Log out everywhere else (used after a password change). */
export function revokeOtherSessions(db: Db, userId: string, keepToken: string) {
  db.delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, sha256(keepToken))))
    .run();
}

export function revokeAllSessions(db: Db, userId: string) {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
}

export function purgeExpiredSessions(db: Db) {
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now())).run();
}
