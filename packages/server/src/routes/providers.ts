import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PROVIDER_TYPES } from "@deliverator/shared";
import type { AppEnv } from "../context.js";
import { requireAuth } from "../auth/middleware.js";
import type { ProviderInput } from "../providers/manager.js";
import type { ProviderCredentials } from "../providers/types.js";

const providerBody = z.object({
  type: z.enum(PROVIDER_TYPES),
  name: z.string().trim().min(1).max(60),
  url: z.string().trim().url().max(500),
  enabled: z.boolean().optional(),
  username: z.string().max(200).optional(),
  password: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
});
type ProviderBody = z.infer<typeof providerBody>;

const limitsBody = z.object({
  download: z.number().int().min(0).optional(),
  upload: z.number().int().min(0).optional(),
  altEnabled: z.boolean().optional(),
});

/**
 * Turn the flat form body into typed credentials. When editing, blank secrets mean
 * "keep what is stored", so the UI never has to round-trip passwords.
 */
function toInput(body: ProviderBody, stored: ProviderCredentials | null): ProviderInput | { error: string } {
  const url = body.url.replace(/\/+$/, "");
  let credentials: ProviderCredentials;
  if (body.type === "qbittorrent") {
    const prev = stored?.type === "qbittorrent" ? stored : null;
    const username = body.username?.trim() || prev?.username || "";
    const password = body.password || prev?.password || "";
    credentials = { type: "qbittorrent", username, password };
  } else {
    const prev = stored?.type === "sabnzbd" ? stored : null;
    const apiKey = body.apiKey?.trim() || prev?.apiKey || "";
    if (!apiKey) return { error: "An API key is required (SABnzbd → Config → General → API Key)" };
    credentials = { type: "sabnzbd", apiKey };
  }
  return { type: body.type, name: body.name, url, enabled: body.enabled, credentials };
}

export const providerRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", (c) => c.json(c.get("ctx").providers.list()))
  .post("/", zValidator("json", providerBody), (c) => {
    const input = toInput(c.req.valid("json"), null);
    if ("error" in input) return c.json({ error: input.error }, 400);
    return c.json(c.get("ctx").providers.create(input), 201);
  })
  .post("/test", zValidator("json", providerBody.extend({ id: z.string().optional() })), async (c) => {
    const body = c.req.valid("json");
    const { providers } = c.get("ctx");
    const input = toInput(body, body.id ? providers.storedCredentials(body.id) : null);
    if ("error" in input) return c.json({ error: input.error }, 400);
    try {
      const result = await providers.adapterFor(input).testConnection();
      return c.json({ ok: true, version: result.version });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })
  .put("/:id", zValidator("json", providerBody), (c) => {
    const { providers } = c.get("ctx");
    const id = c.req.param("id");
    const input = toInput(c.req.valid("json"), providers.storedCredentials(id));
    if ("error" in input) return c.json({ error: input.error }, 400);
    const updated = providers.update(id, input);
    return updated ? c.json(updated) : c.json({ error: "Provider not found" }, 404);
  })
  .delete("/:id", (c) => {
    const ok = c.get("ctx").providers.delete(c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "Provider not found" }, 404);
  })
  .post("/:id/limits", zValidator("json", limitsBody), async (c) => {
    const { providers } = c.get("ctx");
    const entry = providers.get(c.req.param("id"));
    if (!entry) return c.json({ error: "Provider not found" }, 404);
    await entry.adapter.setSpeedLimits(c.req.valid("json"));
    providers.pokeSoon();
    return c.json({ ok: true });
  })
  .post("/:id/pause", async (c) => {
    const { providers } = c.get("ctx");
    const entry = providers.get(c.req.param("id"));
    if (!entry) return c.json({ error: "Provider not found" }, 404);
    await entry.adapter.pauseAll();
    providers.pokeSoon();
    return c.json({ ok: true });
  })
  .post("/:id/resume", async (c) => {
    const { providers } = c.get("ctx");
    const entry = providers.get(c.req.param("id"));
    if (!entry) return c.json({ error: "Provider not found" }, 404);
    await entry.adapter.resumeAll();
    providers.pokeSoon();
    return c.json({ ok: true });
  });
