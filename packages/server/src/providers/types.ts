import type {
  Download,
  DownloadFile,
  ProviderCapabilities,
  ProviderStatus,
  ProviderType,
  SpeedLimits,
} from "@deliverator/shared";

/** Decrypted, type-specific connection details. */
export type ProviderCredentials =
  | { type: "qbittorrent"; username: string; password: string }
  | { type: "sabnzbd"; apiKey: string };

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  url: string;
  credentials: ProviderCredentials;
}

export interface PollResult {
  status: Omit<ProviderStatus, "providerId" | "connected" | "error" | "updatedAt">;
  downloads: Download[];
  categories: string[];
}

export interface AddRequest {
  urls?: string[];
  files?: { name: string; data: Buffer }[];
  category?: string;
  paused?: boolean;
}

/**
 * The contract every download client implements. Ids passed in are the provider's
 * native ids (torrent hash, nzo_id); the manager strips the provider prefix first.
 */
export interface ProviderAdapter {
  readonly type: ProviderType;
  readonly capabilities: ProviderCapabilities;
  testConnection(): Promise<{ version: string }>;
  poll(): Promise<PollResult>;
  add(req: AddRequest): Promise<void>;
  pause(ids: string[]): Promise<void>;
  resume(ids: string[]): Promise<void>;
  remove(ids: string[], deleteFiles: boolean): Promise<void>;
  moveToTop(ids: string[]): Promise<void>;
  moveToBottom(ids: string[]): Promise<void>;
  retry(ids: string[]): Promise<void>;
  setCategory(ids: string[], category: string): Promise<void>;
  setSpeedLimits(limits: Partial<SpeedLimits>): Promise<void>;
  pauseAll(): Promise<void>;
  resumeAll(): Promise<void>;
  files(id: string): Promise<DownloadFile[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Dependency-injected fetch so adapters are unit-testable without a network. */
export type FetchFn = typeof fetch;

export interface AdapterOptions {
  fetch?: FetchFn;
  /** ms, default 15000 */
  timeoutMs?: number;
}

export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export async function fetchWithTimeout(fetchFn: FetchFn, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new ProviderError(`Timed out after ${timeoutMs / 1000}s talking to ${url}`);
    throw new ProviderError(err instanceof Error ? describeNetworkError(err) : String(err));
  } finally {
    clearTimeout(timer);
  }
}

function describeNetworkError(err: Error): string {
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  const code = cause?.code;
  if (code === "ECONNREFUSED") return "Connection refused. Is the client running and the port right?";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "Host not found. Check the URL.";
  if (code === "ETIMEDOUT") return "Connection timed out.";
  if (code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "SELF_SIGNED_CERT_IN_CHAIN" || code === "ERR_TLS_CERT_ALTNAME_INVALID")
    return "Certificate not trusted. Set ALLOW_SELF_SIGNED_CERTS=true if this is expected.";
  return cause?.message ?? err.message;
}
