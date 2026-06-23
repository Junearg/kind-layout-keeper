import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Autenticando..." }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase procesa automáticamente el token del hash
        // Solo necesitamos esperar a que se complete la autenticación
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          // Si no hay sesión después de procesar el hash, mostrar error
          setStatus("error");
          setError(error?.message || "No se pudo procesar el enlace de acceso");
          return;
        }

        // Sesión establecida, ir al resumen
        setStatus("success");
        setTimeout(() => {
          navigate({ to: "/resumen" });
        }, 500);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    };

    handleCallback();
  }, [navigate]);

  if (status === "loading") {
    return (
      <div style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        background: "var(--paper)", padding: 24,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Autenticando...</h2>
          <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Procesando tu enlace de acceso</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        background: "var(--paper)", padding: 24,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>¡Bienvenido!</h2>
          <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Redirigiendo al dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--paper)", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "var(--card)",
        border: "1px solid #fecaca", borderRadius: 16,
        padding: 28, boxShadow: "0 12px 32px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 16, textAlign: "center" }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#b42318" }}>
          Enlace expirado
        </h2>
        <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
          {error || "Tu enlace de acceso ha expirado o no es válido."}
        </p>
        <p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 20 }}>
          Los enlaces de acceso son válidos por 24 horas.
        </p>
        <button
          onClick={() => navigate({ to: "/" })}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10,
            background: "var(--ink)", color: "var(--paper)",
            border: 0, fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Volver al login
        </button>
      </div>
    </div>
  );
}
