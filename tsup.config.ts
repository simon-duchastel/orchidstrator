import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    target: "node20",
    clean: true,
    sourcemap: true,
    dts: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: { main: "src/main.ts" },
    format: ["esm"],
    target: "node20",
    sourcemap: true,
    dts: true,
  },
]);
