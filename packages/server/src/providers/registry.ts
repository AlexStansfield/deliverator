import type { ProviderCapabilities, ProviderType } from "@deliverator/shared";
import type { AdapterOptions, ProviderAdapter, ProviderConfig } from "./types.js";
import { QBittorrentAdapter, QBITTORRENT_CAPABILITIES } from "./qbittorrent.js";
import { SABnzbdAdapter, SABNZBD_CAPABILITIES } from "./sabnzbd.js";

/**
 * To add a client: implement ProviderAdapter, add its type to PROVIDER_TYPES in @deliverator/shared,
 * and register it here. The UI picks up capabilities automatically.
 */
export const PROVIDER_DEFINITIONS: Record<
  ProviderType,
  { label: string; capabilities: ProviderCapabilities; defaultPort: number; credentialFields: ("username" | "password" | "apiKey")[] }
> = {
  qbittorrent: { label: "qBittorrent", capabilities: QBITTORRENT_CAPABILITIES, defaultPort: 8080, credentialFields: ["username", "password"] },
  sabnzbd: { label: "SABnzbd", capabilities: SABNZBD_CAPABILITIES, defaultPort: 8080, credentialFields: ["apiKey"] },
};

export function createAdapter(config: ProviderConfig, opts: AdapterOptions = {}): ProviderAdapter {
  switch (config.credentials.type) {
    case "qbittorrent":
      return new QBittorrentAdapter(config.id, config.url, config.credentials.username, config.credentials.password, opts);
    case "sabnzbd":
      return new SABnzbdAdapter(config.id, config.url, config.credentials.apiKey, opts);
  }
}
