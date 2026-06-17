// Panel que replica las métricas de la columna J del GSheet "Dashboard" de Fudo.
// Los números son clickeables y abren un modal con el listado de cuentas.

import { useState } from "react";
import { useSheetsDashboard, type CountryKPIs } from "@/data/google-sheets";
import { AccountsModal, type EstadoCuenta } from "./AccountsModal";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const ORANGE      = "#E8631A";
const ORANGE_SOFT = "#FDF0E8";
const RED         = "#DC2626";
const RED_SOFT    = "#FEF2F2";
const GREEN       = "#16A34A";
const AMBER       = "#D97706";

const nfmt = (n: number) => Math.round(n).toLocaleString("es-AR");
const pctFmt = (n: number) => `${n.toFixed(1)}%`;

// ─── Tipo para el modal activo ────────────────────────────────────────────────

type ModalState = {
  title: string;
  estado: EstadoCuenta;
} | null;

// ─── Fila de métrica clickeable ───────────────────────────────────────────────

function KpiRow({
  label,
  value,
  accent,
  sub,
  onClick,
}: {
  label: string;
  value: string | null;
  accent?: string;
  sub?: string;
  onClick?: () => void;
}) {
  const isClickable = !!onClick && value != null && value !== "—";

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "9px 0",
      borderBottom: "1px solid var(--rule, #E8E6DC)",
    }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--ink-2, #3A3A38)", lineHeight: 1.3 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: "var(--ink-4, #A8A79E)", marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>

      {/* Valor — botón si tiene onClick */}
      {isClickable ? (
        <button
          onClick={onClick}
          title={`Ver listado de ${label}`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 17,
            fontWeight: 700,
            fontFamily: "'Inter', sans-serif",
            color: accent ?? "var(--ink, #1A1A18)",
            letterSpacing: "-0.02em",
            textDecoration: "underline dotted",
            textUnderlineOffset: 3,
            transition: "opacity 0.12s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          {value}
        </button>
      ) : (
        <span style={{
          fontSize: 17,
          fontWeight: 700,
          fontFamily: "'Inter', sans-serif",
          color: accent ?? "var(--ink, #1A1A18)",
          padding: "4px 8px",
          letterSpacing: "-0.02em",
        }}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

// ─── Sección con kicker ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "var(--ink-4, #A8A79E)",
        paddingBottom: 4,
        marginBottom: 2,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Selector de país ─────────────────────────────────────────────────────────

function CountrySelector({
  countries,
  selected,
  onChange,
}: {
  countries: string[];
  selected: string;
  onChange: (c: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 20 }}>
      {countries.map((c) => {
        const active = c === selected;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            style={{
              padding: "5px 12px",
              borderRadius: 99,
              border: active ? "none" : "1px solid var(--rule, #E8E6DC)",
              background: active ? ORANGE : "transparent",
              color: active ? "#fff" : "var(--ink-2, #3A3A38)",
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              lineHeight: 1.4,
            }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// ─── Bloque de KPIs de un país ────────────────────────────────────────────────

function CountryKPIBlock({
  kpis,
  pais,
  onOpenModal,
}: {
  kpis: CountryKPIs;
  pais: string;
  onOpenModal: (state: ModalState) => void;
}) {
  const pvpColor =
    kpis.proyectadoVsPlan == null ? undefined
      : kpis.proyectadoVsPlan > 15 ? RED
      : kpis.proyectadoVsPlan > 0  ? AMBER
      : GREEN;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: 28,
    }}>
      {/* ── Cuentas operativas (J5–J8) ── */}
      <Section title="Cuentas · hoy">
        <KpiRow
          label="Bajas Confirmadas"
          value={kpis.bajasConfirmadas != null ? nfmt(kpis.bajasConfirmadas) : null}
          accent={kpis.bajasConfirmadas != null && kpis.bajasConfirmadas > 200 ? RED : undefined}
          onClick={() => onOpenModal({
            title: "Bajas Confirmadas",
            estado: "Baja",
          })}
        />
        <KpiRow
          label="Cuentas a Recuperar"
          value={kpis.cuentasARecuperar != null ? nfmt(kpis.cuentasARecuperar) : null}
          accent={ORANGE}
          onClick={() => onOpenModal({
            title: "Cuentas a Recuperar",
            estado: "A Recuperar",
          })}
        />
        <KpiRow
          label="C/ vtas últimos 7 días"
          value={kpis.cvtasUltimos7d != null ? nfmt(kpis.cvtasUltimos7d) : null}
          accent={GREEN}
          sub="activas con ventas en la semana"
        />
        <KpiRow
          label="S/ vtas últimos 7 días"
          value={kpis.svtasUltimos7d != null ? nfmt(kpis.svtasUltimos7d) : null}
          accent={RED}
          sub="activas sin ventas en la semana"
        />
      </Section>

      {/* ── Churn vs plan (J24–J25) ── */}
      <Section title="Churn vs plan · mes actual">
        <KpiRow
          label="Proyectado Neto vs Plan"
          value={kpis.proyectadoVsPlan != null ? pctFmt(kpis.proyectadoVsPlan) : null}
          accent={pvpColor}
          sub={
            kpis.proyectadoVsPlan == null ? undefined
              : kpis.proyectadoVsPlan > 0
                ? "por encima del objetivo"
                : "dentro del objetivo ✓"
          }
        />
        <KpiRow
          label="# Recuperar para estar on target"
          value={kpis.nRecuperar != null ? nfmt(kpis.nRecuperar) : null}
          accent={ORANGE}
          sub="cuentas que hay que recuperar"
        />
      </Section>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GoogleSheetsDashboard() {
  const { data, isLoading, error, dataUpdatedAt } = useSheetsDashboard();
  const [selectedCountry, setSelectedCountry] = useState<string>("Región");
  const [modal, setModal] = useState<ModalState>(null);

  const activeCountry =
    data?.countries.includes(selectedCountry) ? selectedCountry
      : data?.countries[0] ?? "Región";

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const kpis = data?.byCountry[activeCountry] ?? null;

  return (
    <>
      <section
        style={{
          padding: "20px 24px",
          marginBottom: 16,
          border: "1px solid var(--rule, #E8E6DC)",
          borderRadius: 14,
          background: "var(--paper, #FDFCF8)",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}>
          <div>
            <h2 className="serif" style={{ fontSize: 17, margin: 0, letterSpacing: "-0.01em" }}>
              Dashboard · <span style={{ color: ORANGE }}>GSheet en vivo</span>
            </h2>
            {data?.fecha && (
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                Hoy: <strong>{data.fecha}</strong>
                <span style={{ opacity: 0.6, marginLeft: 6 }}>
                  · Hacé click en un número para ver el listado
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 99,
              background: ORANGE_SOFT,
              color: ORANGE,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}>
              GOOGLE SHEETS
            </span>
            {updatedLabel && (
              <span style={{ fontSize: 10, color: "var(--ink-4)" }}>{updatedLabel}</span>
            )}
          </div>
        </div>

        {/* ── Carga / error ── */}
        {isLoading && (
          <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "16px 0" }}>
            Cargando datos del spreadsheet…
          </div>
        )}
        {error && (
          <div style={{
            fontSize: 12, color: RED, background: RED_SOFT,
            padding: "10px 14px", borderRadius: 8, marginBottom: 12,
          }}>
            Error al leer el GSheet: {(error as Error).message}
          </div>
        )}

        {/* ── Selector de país ── */}
        {data && data.countries.length > 0 && (
          <CountrySelector
            countries={data.countries}
            selected={activeCountry}
            onChange={setSelectedCountry}
          />
        )}

        {/* ── KPIs ── */}
        {kpis && (
          <CountryKPIBlock
            kpis={kpis}
            pais={activeCountry}
            onOpenModal={setModal}
          />
        )}

        {data && !kpis && (
          <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "8px 0" }}>
            No hay datos para {activeCountry}.
          </div>
        )}
      </section>

      {/* ── Modal de cuentas ── */}
      {modal && (
        <AccountsModal
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal.title}
          estado={modal.estado}
          pais={activeCountry}
        />
      )}
    </>
  );
}
