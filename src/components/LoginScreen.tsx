import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(error);
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
          Fudo <span style={{ color: "var(--orange)" }}>Churn</span> Center
        </h1>
        <p className="muted fs-12" style={{ marginBottom: 20 }}>
          Iniciá sesión para acceder al dashboard.
        </p>
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
        <p className="muted fs-11" style={{ marginTop: 16, lineHeight: 1.5 }}>
          ¿No tenés cuenta? El acceso lo crea el administrador desde el backend.
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 8, border: "1px solid var(--rule-2)",
  background: "var(--paper)", fontSize: 13, color: "var(--ink)",
  fontFamily: "inherit", outline: "none",
};
