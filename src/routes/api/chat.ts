import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildDashboardContext } from "@/lib/dashboard-context";

const SYSTEM = `Sos un asistente analítico embebido en el dashboard de Churn Intelligence Hub de Fudo (operaciones de Customer Success en LATAM).

REGLAS:
- Respondé en español rioplatense, claro y conciso.
- Basate ÚNICAMENTE en los datos del bloque DATOS_DASHBOARD que aparece abajo. Si una pregunta no se puede responder con esos datos, decílo explícitamente.
- Cuando cites números, usá los exactos del dataset. Cuando hagas comparaciones o tendencias, mostrá los valores.
- Si la pregunta es ambigua, hacé una repregunta corta antes de inventar.
- Formato: markdown. Usá listas, tablas chicas o **bold** cuando ayude. Nada de bloques de código JSON crudos.
- Cuando sea relevante, indicá en qué tab del dashboard se puede ver el detalle (Resumen, Tendencia, NPS, Health Score, Cola CS, KPIs).

DATOS_DASHBOARD (snapshot Mayo 2026):
${buildDashboardContext()}`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        try {
          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");
          const result = streamText({
            model,
            system: SYSTEM,
            messages: await convertToModelMessages(body.messages),
          });
          return result.toUIMessageStreamResponse({ originalMessages: body.messages });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI gateway error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
