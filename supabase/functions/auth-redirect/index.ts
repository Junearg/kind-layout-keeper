import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Extraer el token y el tipo de error
  const token = params.get("access_token");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  // URL de destino en producción
  const productionUrl = "https://fudocenter.quantixarg.cloud";

  // Si hay un token, redirigir con el token en el hash
  if (token) {
    const redirectUrl = `${productionUrl}?access_token=${encodeURIComponent(token)}`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl,
      },
    });
  }

  // Si hay error, redirigir con los parámetros de error
  if (error) {
    const params = new URLSearchParams({
      error,
      error_description: errorDescription || "",
    });
    const redirectUrl = `${productionUrl}/?${params.toString()}`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl,
      },
    });
  }

  // Si no hay parámetros, redirigir al home
  return new Response(null, {
    status: 302,
    headers: {
      "Location": productionUrl,
    },
  });
});
