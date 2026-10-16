import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { generatePassword, hashPassword } from "./password.js";
import { revokeAllSessions } from "./session.js";

export const DEFAULT_USERNAME = "admin";

export function passwordBanner(username: string, password: string, reset = false): string {
  const title = reset ? "Password reset" : "First start: admin account created";
  const lines = [
    "",
    "  ┌────────────────────────────────────────────────────┐",
    `  │  ${title.padEnd(50)}│`,
    "  │                                                    │",
    `  │  Username: ${username.padEnd(40)}│`,
    `  │  Password: ${password.padEnd(40)}│`,
    "  │                                                    │",
    "  │  Change it in Settings → Account after logging in. │",
    "  └────────────────────────────────────────────────────┘",
    "",
  ];
  return lines.join("\n");
}

/** Create the single admin user on first boot. Returns the generated password, or null if a user already existed. */
export function ensureAdminUser(db: Db): { username: string; password: string } | null {
  const existing = db.select({ id: schema.users.id }).from(schema.users).get();
  if (existing) return null;
  const password = generatePassword();
  const now = Date.now();
  db.insert(schema.users)
    .values({ id: crypto.randomUUID(), username: DEFAULT_USERNAME, passwordHash: hashPassword(password), createdAt: now, updatedAt: now })
    .run();
  return { username: DEFAULT_USERNAME, password };
}

export function resetPassword(db: Db, username = DEFAULT_USERNAME): { username: string; password: string } {
  const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (!user) throw new Error(`No user named "${username}"`);
  const password = generatePassword();
  db.update(schema.users)
    .set({ passwordHash: hashPassword(password), updatedAt: Date.now() })
    .where(eq(schema.users.id, user.id))
    .run();
  revokeAllSessions(db, user.id);
  return { username, password };
}
