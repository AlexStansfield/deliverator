declare global {
  interface Window {
    __DELIVERATOR__?: { basePath: string; version: string };
  }
}

/** "" at the root, "/downloader" when served under a sub-path. Injected by the server. */
export const basePath: string = window.__DELIVERATOR__?.basePath ?? "";
export const serverVersion: string = window.__DELIVERATOR__?.version ?? "dev";

export function apiUrl(path: string): string {
  return `${basePath}/api${path.startsWith("/") ? path : `/${path}`}`;
}
