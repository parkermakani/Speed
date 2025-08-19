/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest config (ignored by `vite build`)
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  } as any,
  assetsInclude: ["**/*.glb"],
  resolve: {
    alias: {
      "@icons": resolve(__dirname, "src/assets/Icons"),
    },
  },
} as any);
