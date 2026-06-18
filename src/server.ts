import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// Public Supabase config the browser needs. Injected into the SSR HTML at
// runtime from process.env so it never has to be baked into the client bundle
// at build time (no build args, no rebuild to change config). The publishable
// key and URL are public by design — safe to embed in the page.
function serializeRuntimeConfig(): string {
  const config = {
    url: process.env.SUPABASE_URL ?? "",
    key: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  };
  // Escape "<" so a value can never break out of the <script> tag.
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<script>window.__SUPABASE_CONFIG__=${json}</script>`;
}

// Inject the runtime config as the first element inside <head>, so it runs
// before the deferred app bundle creates the Supabase client. Only touches
// HTML responses — JSON/streaming API responses pass through untouched.
async function injectRuntimeConfig(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const script = serializeRuntimeConfig();
  const injected = html.includes("<head>")
    ? html.replace("<head>", `<head>${script}`)
    : `${script}${html}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length"); // body length changed
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return await injectRuntimeConfig(normalized);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
