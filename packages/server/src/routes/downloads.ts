import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AddDownloadResult } from "@deliverator/shared";
import type { AppEnv } from "../context.js";
import { requireAuth } from "../auth/middleware.js";
import { detectFileKind, detectLinkKind, type LinkKind } from "@deliverator/shared";
import type { ProviderEntry, ProviderManager } from "../providers/manager.js";

const ACTIONS = ["pause", "resume", "delete", "top", "bottom", "retry", "setCategory"] as const;

const actionBody = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum(ACTIONS),
  deleteFiles: z.boolean().optional(),
  category: z.string().max(100).optional(),
});

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Pick the provider for a link/file: explicit choice wins, otherwise by kind, otherwise the only candidate. */
function chooseProvider(manager: ProviderManager, kind: LinkKind, explicitId: string | undefined): ProviderEntry | { error: string } {
  if (explicitId) {
    const e = manager.get(explicitId);
    return e ?? { error: "Provider not found" };
  }
  const enabled = manager.list().filter((p) => p.enabled);
  const candidates = enabled.filter((p) => (kind === "torrent" ? p.capabilities.torrents : kind === "nzb" ? p.capabilities.nzbs : true));
  if (candidates.length === 0) {
    const what = kind === "torrent" ? "torrents" : kind === "nzb" ? "NZBs" : "this link";
    return { error: enabled.length === 0 ? "No providers configured" : `No provider accepts ${what}` };
  }
  if (candidates.length > 1 && kind === "unknown") return { error: "Could not tell what kind of link this is. Pick a provider." };
  return manager.get(candidates[0]!.id)!;
}

export const downloadRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  /** Accepts JSON { urls, providerId?, category?, paused? } or multipart with "files" plus the same fields. */
  .post("/", async (c) => {
    const { providers } = c.get("ctx");
    const contentType = c.req.header("content-type") ?? "";
    let urls: string[] = [];
    let files: { name: string; data: Buffer }[] = [];
    let providerId: string | undefined;
    let category: string | undefined;
    let paused = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      urls = String(form.get("urls") ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      providerId = String(form.get("providerId") ?? "") || undefined;
      category = String(form.get("category") ?? "") || undefined;
      paused = form.get("paused") === "true";
      for (const f of form.getAll("files")) {
        if (!(f instanceof File)) continue;
        if (f.size > MAX_FILE_BYTES) return c.json({ error: `${f.name} is larger than 10 MB` }, 400);
        files.push({ name: f.name, data: Buffer.from(await f.arrayBuffer()) });
      }
    } else {
      const body = z
        .object({
          urls: z.array(z.string().trim().min(1)).max(100).default([]),
          providerId: z.string().optional(),
          category: z.string().max(100).optional(),
          paused: z.boolean().optional(),
        })
        .safeParse(await c.req.json().catch(() => ({})));
      if (!body.success) return c.json({ error: "Invalid request" }, 400);
      urls = body.data.urls;
      providerId = body.data.providerId;
      category = body.data.category;
      paused = body.data.paused ?? false;
    }
    if (urls.length === 0 && files.length === 0) return c.json({ error: "Nothing to add" }, 400);

    const result: AddDownloadResult = { added: [], failed: [] };
    const batches = new Map<ProviderEntry, { urls: string[]; files: { name: string; data: Buffer }[] }>();
    const assign = (label: string, kind: LinkKind, add: (b: { urls: string[]; files: { name: string; data: Buffer }[] }) => void) => {
      const target = chooseProvider(providers, kind, providerId);
      if ("error" in target) {
        result.failed.push({ url: label, reason: target.error });
        return;
      }
      const batch = batches.get(target) ?? { urls: [], files: [] };
      add(batch);
      batches.set(target, batch);
    };
    for (const url of urls) assign(url, detectLinkKind(url), (b) => b.urls.push(url));
    for (const f of files) assign(f.name, detectFileKind(f.name), (b) => b.files.push(f));

    for (const [entry, batch] of batches) {
      try {
        await entry.adapter.add({ urls: batch.urls, files: batch.files, category: category || undefined, paused });
        for (const u of batch.urls) result.added.push({ url: u, providerId: entry.config.id });
        for (const f of batch.files) result.added.push({ url: f.name, providerId: entry.config.id });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        for (const u of batch.urls) result.failed.push({ url: u, reason });
        for (const f of batch.files) result.failed.push({ url: f.name, reason });
      }
    }
    providers.pokeSoon(800);
    return c.json(result, result.added.length > 0 ? 200 : 400);
  })
  .post("/actions", zValidator("json", actionBody), async (c) => {
    const { providers } = c.get("ctx");
    const { ids, action, deleteFiles, category } = c.req.valid("json");
    const errors: string[] = [];
    let done = 0;
    for (const [entry, nativeIds] of providers.groupIds(ids)) {
      const a = entry.adapter;
      try {
        switch (action) {
          case "pause":
            await a.pause(nativeIds);
            break;
          case "resume":
            await a.resume(nativeIds);
            break;
          case "delete":
            await a.remove(nativeIds, deleteFiles ?? false);
            break;
          case "top":
            await a.moveToTop(nativeIds);
            break;
          case "bottom":
            await a.moveToBottom(nativeIds);
            break;
          case "retry":
            await a.retry(nativeIds);
            break;
          case "setCategory":
            await a.setCategory(nativeIds, category ?? "");
            break;
        }
        done += nativeIds.length;
      } catch (err) {
        errors.push(`${entry.config.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    providers.pokeSoon();
    if (errors.length > 0) return c.json({ error: errors.join("; "), done }, done > 0 ? 207 : 502);
    return c.json({ ok: true, done });
  })
  .get("/:id/files", async (c) => {
    const { providers } = c.get("ctx");
    const [entry, nativeIds] = providers.groupIds([c.req.param("id")]).entries().next().value ?? [];
    if (!entry || !nativeIds?.[0]) return c.json({ error: "Download not found" }, 404);
    const files = await entry.adapter.files(nativeIds[0]);
    return c.json({ files });
  });
