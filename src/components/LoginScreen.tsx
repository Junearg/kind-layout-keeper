import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export function LoginScreen() {
  const { signIn, revokedError } = useAuth();

  // ── Login state ──────────────────────────────────────────────────────────────
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Access request state ──────────────────────────────────────────────────────
  const [reqEmail, setReqEmail]     = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const [reqStatus, setReqStatus]   = useState<"idle" | "sent" | "duplicate" | "error">("idle");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(error);
  };

  const isFudoDomain = (e: string) => e.trim().toLowerCase().endsWith("@fu.do");

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = reqEmail.trim().toLowerCase();
    if (!isFudoDomain(trimmed)) return;

    setReqLoading(true);
    setReqStatus("idle");

    // Intentar insertar — falla con unique violation si ya existe
    const { error } = await (supabase as any)
      .from("access_requests")
      .insert({ email: trimmed });

    if (error) {
      if (error.code === "23505") {
        setReqStatus("duplicate");
      } else {
        setReqStatus("error");
      }
      setReqLoading(false);
      return;
    }

    // Intentar notificar al admin (falla silenciosamente si la Edge Function no está deployada)
    supabase.functions.invoke("notify-admin", { body: { email: trimmed } }).catch(() => {});

    setReqStatus("sent");
    setReqLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--paper)", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 360, background: "var(--card)",
        border: "1px solid var(--rule)", borderRadius: 16,
        padding: 28, boxShadow: "0 12px 32px rgba(0,0,0,0.06)",
      }}>
        <div className="brand-mark" style={{ marginBottom: 16 }}>f</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
          Fudo <span style={{ color: "var(--orange)" }}>Customer</span> Center
        </h1>
        <p className="muted fs-12" style={{ marginBottom: 20 }}>
          Iniciá sesión para acceder al dashboard.
        </p>

        {/* Revoke error */}
        {revokedError && (
          <div style={{ background: "#fef3f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "#b42318" }}>
            Tu acceso fue revocado. Contactá al administrador.
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Contraseña
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>
          {error && (
            <div className="fs-12" style={{ color: "#b42318", background: "#fef3f2", padding: "8px 10px", borderRadius: 8 }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: "10px 14px", borderRadius: 10,
              background: "var(--ink)", color: "var(--paper)",
              border: 0, fontSize: 13, fontWeight: 600, cursor: "pointer",
              opacity: loading ? 0.6 : 1, fontFamily: "inherit",
            }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
          <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
          <span className="fs-11 muted">¿Vas a ingresar por primera vez?</span>
          <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
        </div>

        {/* Access request form */}
        {reqStatus === "sent" ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📬</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Solicitud enviada</div>
            <div className="muted fs-12" style={{ marginTop: 4, lineHeight: 1.5 }}>
              El administrador revisará tu solicitud y recibirás un link de acceso por email.
            </div>
          </div>
        ) : (
          <form onSubmit={onRequest} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Tu email @fu.do
              </span>
              <input
                type="email"
                placeholder="nombre@fu.do"
                value={reqEmail}
                onChange={(e) => { setReqEmail(e.target.value); setReqStatus("idle"); }}
                style={inputStyle}
              />
            </label>

            {reqStatus === "duplicate" && (
              <div className="fs-12" style={{ color: "#b45309", background: "#fffbeb", padding: "8px 10px", borderRadius: 8 }}>
                Ya existe una solicitud para este email. El administrador la revisará pronto.
              </div>
            )}
            {reqStatus === "error" && (
              <div className="fs-12" style={{ color: "#b42318", background: "#fef3f2", padding: "8px 10px", borderRadius: 8 }}>
                Ocurrió un error. Intentá de nuevo.
              </div>
            )}

            <button
              type="submit"
              disabled={reqLoading || !isFudoDomain(reqEmail)}
              style={{
                padding: "10px 14px", borderRadius: 10,
                background: "var(--orange-fill)", color: "#fff",
                border: 0, fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: (reqLoading || !isFudoDomain(reqEmail)) ? 0.5 : 1,
                fontFamily: "inherit",
              }}
            >
              {reqLoading ? "Enviando…" : "Pedir link de acceso"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 8, border: "1px solid var(--rule-2)",
  background: "var(--paper)", fontSize: 13, color: "var(--ink)",
  fontFamily: "inherit", outline: "none",
};
