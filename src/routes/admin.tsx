import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Fudo Customer Center" }] }),
  component: AdminGate,
});

const ADMIN_EMAIL = "camed@fu.do";

type AccessRequest = {
  id: string;
  email: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
};

function AdminGate() {
  const { user } = useAuth();
  if (user?.email !== ADMIN_EMAIL) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Acceso restringido</div>
          <div style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 6 }}>Solo el administrador puede ver esta sección.</div>
        </div>
      </div>
    );
  }
  return <AdminPanel />;
}

function AdminPanel() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("access_requests")
      .select("*")
      .order("requested_at", { ascending: false });
    setRequests((data as unknown as AccessRequest[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, email: string, status: string) {
    const { error } = await (supabase as any)
      .from("access_requests")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setActionMsg({ id, msg: "Error: " + error.message, ok: false });
      return;
    }
    if (status === "approved") {
      // Enviar magic link al usuario
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (otpErr) {
        setActionMsg({ id, msg: "Aprobado en DB pero falló el envío del link: " + otpErr.message, ok: false });
      } else {
        setActionMsg({ id, msg: `✓ Link de acceso enviado a ${email}`, ok: true });
      }
    } else {
      const labels: Record<string, string> = { denied: "Solicitud rechazada", revoked: "Acceso revocado", pending: "Restaurado a pendiente", approved: "Aprobado" };
      setActionMsg({ id, msg: labels[status] ?? status, ok: true });
    }
    await load();
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setActionMsg({
      id: email,
      msg: error ? "Error: " + error.message : `Reset de contraseña enviado a ${email}`,
      ok: !error,
    });
    setTimeout(() => setActionMsg(null), 4000);
  }

  const pending  = requests.filter(r => r.status === "pending");
  const approved = requests.filter(r => r.status === "approved");
  const others   = requests.filter(r => r.status === "denied" || r.status === "revoked");

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--ink-3)", marginBottom: 6 }}>
            Fudo Customer Center
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Panel de <span style={{ color: "var(--orange)" }}>accesos</span>
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 6 }}>
            Gestioná solicitudes de acceso al dashboard.
          </p>
        </div>

        {loading ? (
          <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Cargando solicitudes…</div>
        ) : (
          <>
            {/* Solicitudes pendientes */}
            <Section title="Solicitudes pendientes" count={pending.length} accent="var(--orange)">
              {pending.length === 0 ? (
                <Empty msg="No hay solicitudes pendientes." />
              ) : pending.map(r => (
                <RequestRow key={r.id} r={r} fmt={fmt} actionMsg={actionMsg}>
                  <Btn label="Aprobar" color="var(--orange-fill)" onClick={() => setStatus(r.id, r.email, "approved")} />
                  <Btn label="Rechazar" color="var(--ink-3)" onClick={() => setStatus(r.id, r.email, "denied")} />
                </RequestRow>
              ))}
            </Section>

            {/* Accesos aprobados */}
            <Section title="Accesos aprobados" count={approved.length} accent="#16A34A">
              {approved.length === 0 ? (
                <Empty msg="Aún no hay accesos aprobados." />
              ) : approved.map(r => (
                <RequestRow key={r.id} r={r} fmt={fmt} actionMsg={actionMsg}>
                  <Btn label="Resetear contraseña" color="var(--ink-2)" onClick={() => sendPasswordReset(r.email)} />
                  <Btn label="Revocar acceso" color="#DC2626" onClick={() => setStatus(r.id, r.email, "revoked")} />
                </RequestRow>
              ))}
            </Section>

            {/* Rechazados / Revocados */}
            {others.length > 0 && (
              <Section title="Rechazados / Revocados" count={others.length} accent="var(--ink-3)">
                {others.map(r => (
                  <RequestRow key={r.id} r={r} fmt={fmt} actionMsg={actionMsg}>
                    <Btn label="Restaurar" color="var(--ink-2)" onClick={() => setStatus(r.id, r.email, "pending")} />
                  </RequestRow>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{title}</span>
        <span style={{ background: accent, color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 8px" }}>{count}</span>
      </div>
      <div style={{ border: "1px solid var(--rule)", borderRadius: 12, overflow: "hidden", background: "var(--card)" }}>
        {children}
      </div>
    </div>
  );
}

function RequestRow({ r, fmt, actionMsg, children }: {
  r: AccessRequest;
  fmt: (s: string) => string;
  actionMsg: { id: string; msg: string; ok: boolean } | null;
  children: React.ReactNode;
}) {
  const msg = actionMsg?.id === r.id || actionMsg?.id === r.email ? actionMsg : null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
      borderBottom: "1px solid var(--rule)", flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{r.email}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
          Solicitó el {fmt(r.requested_at)}
          {r.reviewed_at && ` · Revisado ${fmt(r.reviewed_at)}`}
        </div>
        {msg && (
          <div style={{ fontSize: 11, marginTop: 4, color: msg.ok ? "#16A34A" : "#DC2626", fontWeight: 500 }}>
            {msg.msg}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Btn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
        background: color, color: "#fff", border: "none", cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>{msg}</div>
  );
}
