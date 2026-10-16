import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Config } from "../config.js";
import { openDb } from "../db/index.js";
import { logger } from "../log.js";
import type { AppContext } from "../context.js";
import { ProviderManager } from "../providers/manager.js";
import type { AdapterOptions } from "../providers/types.js";

export function testContext(overrides: Partial<Config> = {}, adapterOptions?: AdapterOptions): AppContext {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deliverator-test-"));
  const config: Config = {
    port: 0,
    host: "127.0.0.1",
    dataDir,
    dbPath: ":memory:",
    basePath: "",
    secretKey: crypto.randomBytes(32),
    allowSelfSignedCerts: false,
    pollIntervalMs: 2000,
    logLevel: "error",
    clientDir: null,
    ...overrides,
  };
  const db = openDb(config.dbPath);
  const log = logger("test");
  const providers = new ProviderManager(db, log, { pollIntervalMs: config.pollIntervalMs, secretKey: config.secretKey, adapterOptions });
  return { config, db, log, version: "test", providers };
}

/** Extracts the session cookie value from a login response. */
export function cookieFrom(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const m = header.match(/deliverator_session=([^;]+)/);
  if (!m) throw new Error("no session cookie in response");
  return `deliverator_session=${m[1]}`;
}
