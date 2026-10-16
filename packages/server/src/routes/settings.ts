import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@deliverator/shared";
import type { AppEnv } from "../context.js";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";

const PREFS_KEY = "preferences";

const preferencesSchema = z.object({
  theme: z.string().min(1).max(40),
  refreshInterval: z.number().int().min(500).max(60_000),
  speedPresets: z.array(z.number().int().min(0)).max(12),
  confirmDelete: z.boolean(),
  deleteFilesByDefault: z.boolean(),
});

export function getPreferences(db: Db): UserPreferences {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, PREFS_KEY)).get();
  if (!row) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(row.value) as Partial<UserPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(db: Db, prefs: UserPreferences) {
  db.insert(schema.settings)
    .values({ key: PREFS_KEY, value: JSON.stringify(prefs), updatedAt: Date.now() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify(prefs), updatedAt: Date.now() } })
    .run();
}

export const settingsRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/preferences", (c) => c.json(getPreferences(c.get("ctx").db)))
  .put("/preferences", zValidator("json", preferencesSchema), (c) => {
    const prefs = c.req.valid("json");
    savePreferences(c.get("ctx").db, prefs);
    return c.json(prefs);
  });
