import fs from "node:fs";
import path from "node:path";

declare const __APP_VERSION__: string | undefined;

function readFromPackageJson(): string {
  const candidates = [
    path.resolve(import.meta.dirname, "../../../package.json"),
    path.resolve(import.meta.dirname, "../package.json"),
  ];
  for (const c of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(c, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "deliverator" && pkg.version) return pkg.version;
    } catch {
      /* try next */
    }
  }
  return "0.0.0";
}

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : readFromPackageJson();
