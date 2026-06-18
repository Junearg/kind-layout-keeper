// Production Node server for the TanStack Start SSR build.
//
// The SSR build (dist/server/server.js) exports a Web-standard fetch handler
// `{ fetch(request) }`. This file hosts it on a plain Node HTTP server via
// @hono/node-server (the de-facto adapter — handles streaming responses, which
// the /api/chat SSE endpoint needs), and serves the hashed client assets from
// dist/client directly so they never hit the SSR handler.
//
// Runtime env (read by the SSR handler via process.env): SUPABASE_URL,
// SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY.
// These come from the container environment (Dokploy), never baked into the
// client bundle.

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import ssrHandler from "../dist/server/server.js";

const PORT = Number(process.env.PORT) || 3000;
const HOSTNAME = process.env.HOST || "0.0.0.0";

const app = new Hono();

// Content-hashed assets are immutable — cache aggressively.
app.use(
  "/assets/*",
  serveStatic({
    root: "./dist/client",
    onFound: (_path, c) => {
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    },
  }),
);

// Other static files at the client root (favicon, etc.).
app.use("/favicon.ico", serveStatic({ root: "./dist/client" }));

// Everything else → TanStack Start SSR (rendered pages + /api/* routes).
app.all("*", (c) => ssrHandler.fetch(c.req.raw));

serve({ fetch: app.fetch, port: PORT, hostname: HOSTNAME }, (info) => {
  console.log(
    `▶ Fudo Dashboard SSR server listening on http://${HOSTNAME}:${info.port}`,
  );
});
