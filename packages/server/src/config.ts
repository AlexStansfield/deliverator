import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  /** "" for root, otherwise "/sub/path" with leading slash and no trailing slash */
  basePath: string;
  secretKey: Buffer;
  allowSelfSignedCerts: boolean;
  pollIntervalMs: number;
  logLevel: LogLevel;
  /** Absolute path of the built client, or null when not present (dev mode) */
  clientDir: string | null;
}

/** Normalise a user-supplied base path: "downloader/" -> "/downloader", "/" -> "" */
export function normaliseBasePath(input: string | undefined): string {
  let p = (input ?? "").trim();
  if (!p || p === "/") return "";
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "");
  if (!/^\/[A-Za-z0-9._~\-\/]*$/.test(p)) {
    throw new Error(`BASE_PATH "${input}" contains characters that are not allowed in a URL path`);
  }
  return p;
}

function loadOrCreateSecret(dataDir: string, fromEnv: string | undefined): Buffer {
  if (fromEnv && fromEnv.trim()) {
    const raw = fromEnv.trim();
    const buf = /^[0-9a-fA-F]{64,}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "utf8");
    if (buf.length < 32) throw new Error("SECRET_KEY must be at least 32 bytes (64 hex characters)");
    return buf;
  }
  const file = path.join(dataDir, "secret.key");
  if (fs.existsSync(file)) {
    return Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString("hex") + "\n", { mode: 0o600 });
  return key;
}

function findClientDir(): string | null {
  // Works both from source (tsx) and from the built bundle (dist/index.js)
  const candidates = [
    path.resolve(import.meta.dirname, "../../client/dist"),
    path.resolve(import.meta.dirname, "../client"),
    path.resolve(process.cwd(), "packages/client/dist"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "index.html"))) return c;
  }
  return null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dataDir = path.resolve(env.DATA_DIR || "./data");
  fs.mkdirSync(dataDir, { recursive: true });
  const logLevel = (env.LOG_LEVEL || "info") as LogLevel;
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of debug, info, warn, error (got "${env.LOG_LEVEL}")`);
  }
  return {
    port: Number(env.PORT || 3000),
    host: env.HOST || "0.0.0.0",
    dataDir,
    dbPath: path.join(dataDir, "deliverator.db"),
    basePath: normaliseBasePath(env.BASE_PATH),
    secretKey: loadOrCreateSecret(dataDir, env.SECRET_KEY),
    allowSelfSignedCerts: /^(1|true|yes)$/i.test(env.ALLOW_SELF_SIGNED_CERTS || ""),
    pollIntervalMs: Math.max(500, Number(env.POLL_INTERVAL_MS || 2000)),
    logLevel,
    clientDir: findClientDir(),
  };
}
