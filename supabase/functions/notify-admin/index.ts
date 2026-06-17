// Supabase Edge Function — notifica a camed@fu.do cuando llega una solicitud de acceso.
//
// SETUP (una sola vez):
//   1. Crear cuenta gratuita en https://resend.com → obtener API Key
//   2. En Supabase Dashboard → Settings → Edge Functions → Secrets:
//      RESEND_API_KEY = re_xxxxxxxxxxxx
//   3. Deployar: supabase functions deploy notify-admin --no-verify-jwt
//
// La función se llama desde el frontend al insertar una solicitud.
// Si no está deployada, falla silenciosamente (el panel admin sigue funcionando).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ADMIN_EMAIL = "camed@fu.do";
const RESEND_API   = "https://api.resend.com/emails";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const { email } = await req.json() as { email: string };
  const apiKey = Deno.env.get("RESEND_API_KEY");

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurada" }), { status: 500 });
  }

  const adminUrl = `${req.headers.get("origin") ?? "https://tu-app.vercel.app"}/admin`;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    "Fudo Customer Center <noreply@fu.do>",
      to:      [ADMIN_EMAIL],
      subject: `Nueva solicitud de acceso — ${email}`,
      html: `
        <p>Hola Carla,</p>
        <p><strong>${email}</strong> solicitó acceso a Fudo Customer Center.</p>
        <p><a href="${adminUrl}" style="background:#F05A28;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">
          Revisar solicitud
        </a></p>
        <p style="color:#888;font-size:12px;margin-top:24px">Fudo Customer Center · Panel de admin</p>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
});
