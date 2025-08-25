/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
      interval: 100,
      depth: 99,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 100 },
    },
  },
  // Vitest config (ignored by `vite build`)
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  } as any,
  assetsInclude: ["**/*.glb", "**/*.svg"],
} as any);
