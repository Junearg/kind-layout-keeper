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

  // ── Signup state ──────────────────────────────────────────────────────────────
  const [signupMode, setSignupMode] = useState(false);
  const [signupEmail, setSignupEmail]       = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm]   = useState("");
  const [signupLoading, setSignupLoading]   = useState(false);
  const [signupError, setSignupError]       = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess]   = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(error);
  };

  const isFudoDomain = (e: string) => e.trim().toLowerCase().endsWith("@fu.do");

  const onSignup = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = signupEmail.trim().toLowerCase();

    if (!isFudoDomain(trimmed)) {
      setSignupError("Solo se permiten emails @fu.do");
      return;
    }

    if (signupPassword.length < 8) {
      setSignupError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (signupPassword !== signupConfirm) {
      setSignupError("Las contraseñas no coinciden");
      return;
    }

    setSignupLoading(true);
    setSignupError(null);

    const { error } = await supabase.auth.signUp({
      email: trimmed,
      password: signupPassword,
    });

    setSignupLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        setSignupError("Este email ya está registrado. Usa contraseña para entrar.");
      } else {
        setSignupError(error.message);
      }
      return;
    }

    setSignupSuccess(true);
    setTimeout(() => {
      setSignupMode(false);
      setSignupSuccess(false);
      setEmail(trimmed);
      setSignupPassword("");
      setSignupConfirm("");
    }, 2000);
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

        {/* Signup mode toggle */}
        {!signupMode ? (
          <button
            type="button"
            onClick={() => setSignupMode(true)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              background: "var(--orange-fill)", color: "#fff",
              border: 0, fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Crear cuenta con contraseña
          </button>
        ) : (
          <>
            <form onSubmit={onSignup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Email @fu.do
                </span>
                <input
                  type="email"
                  placeholder="nombre@fu.do"
                  required
                  value={signupEmail}
                  onChange={(e) => {
                    setSignupEmail(e.target.value);
                    setSignupError(null);
                  }}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Contraseña
                </span>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  required
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    setSignupError(null);
                  }}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Confirmar contraseña
                </span>
                <input
                  type="password"
                  placeholder="Repite la contraseña"
                  required
                  value={signupConfirm}
                  onChange={(e) => {
                    setSignupConfirm(e.target.value);
                    setSignupError(null);
                  }}
                  style={inputStyle}
                />
              </label>

              {signupError && (
                <div className="fs-12" style={{ color: "#b42318", background: "#fef3f2", padding: "8px 10px", borderRadius: 8 }}>
                  {signupError}
                </div>
              )}

              {signupSuccess && (
                <div className="fs-12" style={{ color: "#15803d", background: "#f0fdf4", padding: "8px 10px", borderRadius: 8 }}>
                  ✓ Cuenta creada. Redirigiendo...
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={signupLoading || signupSuccess}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10,
                    background: "var(--ink)", color: "var(--paper)",
                    border: 0, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    opacity: signupLoading || signupSuccess ? 0.6 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {signupLoading ? "Creando…" : "Crear cuenta"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignupMode(false);
                    setSignupError(null);
                    setSignupEmail("");
                    setSignupPassword("");
                    setSignupConfirm("");
                  }}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10,
                    background: "var(--paper-2)", color: "var(--ink)",
                    border: 0, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Volver
                </button>
              </div>
            </form>
          </>
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
