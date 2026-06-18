import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// SPA mode for Docker/VPS deployment (no SSR, no Cloudflare Worker).
// Uses createRoot instead of hydrateRoot — no server-provided HTML required.
export default defineConfig({
  tanstackStart: {},
});
