import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  splitting: false,
  // Bundle the workspace package; leave real node_modules external.
  noExternal: ["@deliverator/shared"],
  banner: { js: "#!/usr/bin/env node" },
});
