import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { eq, asc } from "drizzle-orm";
import type { Download, ProviderStatus, ProviderSummary, ProviderType, StateSnapshot } from "@deliverator/shared";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import type { ProviderRow } from "../db/schema.js";
import { decrypt, encrypt } from "../crypto.js";
import type { Logger } from "../log.js";
import { createAdapter, PROVIDER_DEFINITIONS } from "./registry.js";
import type { AdapterOptions, ProviderAdapter, ProviderConfig, ProviderCredentials } from "./types.js";

interface Entry {
  config: ProviderConfig;
  row: ProviderRow;
  adapter: ProviderAdapter;
  status: ProviderStatus;
  downloads: Download[];
  categories: string[];
  polling: boolean;
}

export interface ProviderInput {
  type: ProviderType;
  name: string;
  url: string;
  credentials: ProviderCredentials;
  enabled?: boolean;
}

export interface ManagerOptions {
  pollIntervalMs: number;
  secretKey: Buffer;
  adapterOptions?: AdapterOptions;
}

function emptyStatus(providerId: string): ProviderStatus {
  return {
    providerId,
    connected: false,
    error: null,
    version: null,
    downloadSpeed: 0,
    uploadSpeed: 0,
    freeSpace: null,
    remainingBytes: null,
    limits: { download: 0 },
    paused: false,
    updatedAt: null,
  };
}

/**
 * Owns every configured provider: instantiates adapters from the database, polls them on a
 * timer, keeps the latest normalised snapshot in memory and emits "state" whenever it changes.
 */
export class ProviderManager extends EventEmitter {
  private entries = new Map<string, Entry>();
  private timer: NodeJS.Timeout | null = null;
  private pokeTimer: NodeJS.Timeout | null = null;
  private snapshot: StateSnapshot = { providers: [], statuses: [], downloads: [], generatedAt: Date.now() };

  constructor(
    private readonly db: Db,
    private readonly log: Logger,
    private readonly opts: ManagerOptions,
  ) {
    super();
    this.setMaxListeners(100);
    this.loadAll();
  }

  /* ---------- lifecycle ---------- */

  start() {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.opts.pollIntervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Poll again shortly (after an action) so the UI reflects it without waiting a full interval. */
  pokeSoon(delay = 350) {
    if (this.pokeTimer) return;
    this.pokeTimer = setTimeout(() => {
      this.pokeTimer = null;
      void this.tick();
    }, delay);
  }

  private async tick() {
    await Promise.all([...this.entries.values()].map((e) => this.pollOne(e)));
    this.rebuildSnapshot();
  }

  private async pollOne(e: Entry) {
    if (e.polling || !e.row.enabled) return;
    e.polling = true;
    try {
      const result = await e.adapter.poll();
      const wasDown = !e.status.connected;
      e.status = { ...result.status, providerId: e.config.id, connected: true, error: null, updatedAt: Date.now() };
      e.downloads = result.downloads;
      e.categories = result.categories;
      if (wasDown) this.log.info(`${e.config.name}: connected${e.status.version ? ` (${e.status.version})` : ""}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (e.status.connected || e.status.error !== message) this.log.warn(`${e.config.name}: ${message}`);
      e.status = { ...e.status, connected: false, error: message };
    } finally {
      e.polling = false;
    }
  }

  private rebuildSnapshot() {
    const entries = [...this.entries.values()];
    this.snapshot = {
      providers: entries.map((e) => this.summary(e)),
      statuses: entries.map((e) => e.status),
      downloads: entries.flatMap((e) => (e.row.enabled ? e.downloads : [])),
      generatedAt: Date.now(),
    };
    this.emit("state", this.snapshot);
  }

  getSnapshot(): StateSnapshot {
    return this.snapshot;
  }

  /* ---------- configuration ---------- */

  private loadAll() {
    const rows = this.db.select().from(schema.providers).orderBy(asc(schema.providers.sortOrder), asc(schema.providers.createdAt)).all();
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.id);
      const existing = this.entries.get(row.id);
      if (existing && existing.row.updatedAt === row.updatedAt) continue;
      this.entries.set(row.id, this.makeEntry(row, existing));
    }
    for (const id of this.entries.keys()) if (!seen.has(id)) this.entries.delete(id);
    this.rebuildSnapshot();
  }

  private makeEntry(row: ProviderRow, previous?: Entry): Entry {
    const config = this.toConfig(row);
    return {
      config,
      row,
      adapter: createAdapter(config, this.opts.adapterOptions),
      status: previous?.status ?? emptyStatus(row.id),
      downloads: previous?.downloads ?? [],
      categories: previous?.categories ?? [],
      polling: false,
    };
  }

  private toConfig(row: ProviderRow): ProviderConfig {
    const credentials = JSON.parse(decrypt(row.credentials, this.opts.secretKey)) as ProviderCredentials;
    return { id: row.id, type: row.type as ProviderType, name: row.name, url: row.url, credentials };
  }

  private summary(e: Entry): ProviderSummary {
    return {
      id: e.row.id,
      type: e.config.type,
      name: e.row.name,
      url: e.row.url,
      enabled: e.row.enabled,
      username: e.config.credentials.type === "qbittorrent" ? e.config.credentials.username : undefined,
      capabilities: PROVIDER_DEFINITIONS[e.config.type].capabilities,
      categories: e.categories,
      createdAt: e.row.createdAt,
    };
  }

  list(): ProviderSummary[] {
    return [...this.entries.values()].map((e) => this.summary(e));
  }

  get(id: string): Entry | undefined {
    return this.entries.get(id);
  }

  /** Stored credentials for an existing provider (so edits can leave the secret blank). */
  storedCredentials(id: string): ProviderCredentials | null {
    return this.entries.get(id)?.config.credentials ?? null;
  }

  create(input: ProviderInput): ProviderSummary {
    const now = Date.now();
    const id = crypto.randomUUID();
    const maxOrder = [...this.entries.values()].reduce((m, e) => Math.max(m, e.row.sortOrder), -1);
    this.db
      .insert(schema.providers)
      .values({
        id,
        type: input.type,
        name: input.name,
        url: input.url,
        enabled: input.enabled ?? true,
        credentials: encrypt(JSON.stringify(input.credentials), this.opts.secretKey),
        sortOrder: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    this.loadAll();
    this.pokeSoon(0);
    return this.summary(this.entries.get(id)!);
  }

  update(id: string, input: ProviderInput): ProviderSummary | null {
    if (!this.entries.has(id)) return null;
    this.db
      .update(schema.providers)
      .set({
        type: input.type,
        name: input.name,
        url: input.url,
        enabled: input.enabled ?? true,
        credentials: encrypt(JSON.stringify(input.credentials), this.opts.secretKey),
        updatedAt: Date.now(),
      })
      .where(eq(schema.providers.id, id))
      .run();
    this.loadAll();
    this.pokeSoon(0);
    return this.summary(this.entries.get(id)!);
  }

  delete(id: string): boolean {
    if (!this.entries.has(id)) return false;
    this.db.delete(schema.providers).where(eq(schema.providers.id, id)).run();
    this.loadAll();
    return true;
  }

  /** Build an adapter for a config that is not (yet) saved, e.g. "Test connection" in the add form. */
  adapterFor(input: ProviderInput): ProviderAdapter {
    return createAdapter({ id: "test", type: input.type, name: input.name, url: input.url, credentials: input.credentials }, this.opts.adapterOptions);
  }

  /** Split Deliverator ids ("providerId:nativeId") into per-provider native id lists. */
  groupIds(ids: string[]): Map<Entry, string[]> {
    const groups = new Map<Entry, string[]>();
    for (const id of ids) {
      const sep = id.indexOf(":");
      if (sep < 0) continue;
      const entry = this.entries.get(id.slice(0, sep));
      if (!entry) continue;
      const list = groups.get(entry) ?? [];
      list.push(id.slice(sep + 1));
      groups.set(entry, list);
    }
    return groups;
  }
}

export type { Entry as ProviderEntry };
