// Modal que lista cuentas de base_hubspot según Estado de Cuenta
// (A Recuperar o Baja), con filtro por país y búsqueda por nombre.

import { useState, useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAccounts, type EstadoCuenta, type AccountRow } from "@/data/google-sheets";

export type { EstadoCuenta };

// ─── Paleta ───────────────────────────────────────────────────────────────────
const ORANGE      = "#E8631A";
const ORANGE_SOFT = "#FDF0E8";
const RED         = "#DC2626";
const RED_SOFT    = "#FEF2F2";
const GREEN       = "#16A34A";
const GREEN_SOFT  = "#F0FDF4";

// ─── Badges ──────────────────────────────────────────────────────────────────

function LoginBadge({ label }: { label: string }) {
  const isRecent = /menos de 7/i.test(label);
  const bg  = isRecent ? GREEN_SOFT : "#FFF7ED";
  const fg  = isRecent ? GREEN      : ORANGE;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 7px",
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 600,
      background: bg,
      color: fg,
      whiteSpace: "nowrap",
    }}>
      {label || "—"}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: EstadoCuenta }) {
  const isBaja = estado === "Baja";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 600,
      background: isBaja ? RED_SOFT    : ORANGE_SOFT,
      color:      isBaja ? RED         : ORANGE,
    }}>
      {estado}
    </span>
  );
}

function VentasBadge({ ventas }: { ventas: string }) {
  const good = /C\//i.test(ventas);
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 7px",
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 600,
      background: good ? GREEN_SOFT : RED_SOFT,
      color:      good ? GREEN      : RED,
      whiteSpace: "nowrap",
    }}>
      {ventas || "—"}
    </span>
  );
}

// ─── Fila de tabla ────────────────────────────────────────────────────────────

function AccountRow_({ row }: { row: AccountRow }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--rule, #E8E6DC)" }}>
      <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--ink)" }}>
        <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{row.nombre || "—"}</div>
        <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>
          ID {row.idFudo}{row.ejecutivo ? ` · ${row.ejecutivo}` : ""}
        </div>
      </td>
      <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--ink-2)", whiteSpace: "nowrap" }}>
        {row.gmvTier || "—"}
      </td>
      <td style={{ padding: "8px 10px" }}>
        <VentasBadge ventas={row.ventas} />
      </td>
      <td style={{ padding: "8px 10px" }}>
        <LoginBadge label={row.ultimaLogin} />
      </td>
      <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--ink-3)" }}>
        {row.pais || "—"}
      </td>
    </tr>
  );
}

// ─── Cuerpo del modal ────────────────────────────────────────────────────────

export function AccountsModalContent({
  title,
  estado,
  pais,
}: {
  title: string;
  estado: EstadoCuenta;
  pais: string;          // "Región" = todos
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useAccounts();

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.filter(r => r.estado === estado);
    if (pais !== "Región") rows = rows.filter(r => r.pais === pais);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.nombre.toLowerCase().includes(q) ||
        r.idFudo.includes(q) ||
        r.ejecutivo.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, estado, pais, search]);

  const totalSinFiltro = useMemo(() => {
    if (!data) return 0;
    let rows = data.filter(r => r.estado === estado);
    if (pais !== "Región") rows = rows.filter(r => r.pais === pais);
    return rows.length;
  }, [data, estado, pais]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Header del modal ── */}
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid var(--rule, #E8E6DC)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 className="serif" style={{ fontSize: 18, margin: 0 }}>
              {title}
            </h2>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
              {pais !== "Región" && <><strong>{pais}</strong> · </>}
              {isLoading
                ? "Cargando…"
                : <><strong>{totalSinFiltro.toLocaleString("es-AR")}</strong> cuentas</>
              }
            </div>
          </div>
          <DialogPrimitive.Close
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              color: "var(--ink-3)",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            ✕
          </DialogPrimitive.Close>
        </div>

        {/* Search */}
        <div style={{ marginTop: 12, position: "relative" }}>
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: "var(--ink-4)",
          }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre, ID o ejecutivo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              borderRadius: 8,
              border: "1px solid var(--rule, #E8E6DC)",
              fontSize: 13,
              outline: "none",
              background: "var(--paper-2, #F5F4EF)",
              boxSizing: "border-box",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                border: "none", background: "none", cursor: "pointer",
                fontSize: 12, color: "var(--ink-4)",
              }}
            >✕</button>
          )}
        </div>
        {search && (
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
            Mostrando {filtered.length.toLocaleString("es-AR")} de {totalSinFiltro.toLocaleString("es-AR")}
          </div>
        )}
      </div>

      {/* ── Body — tabla scrollable ── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {isLoading && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            Cargando cuentas desde el spreadsheet…
          </div>
        )}

        {error && (
          <div style={{
            margin: 16,
            padding: "10px 14px",
            background: RED_SOFT,
            color: RED,
            borderRadius: 8,
            fontSize: 12,
          }}>
            Error: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            {search ? "Sin resultados para esa búsqueda." : "No hay cuentas en esta categoría."}
          </div>
        )}

        {filtered.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{
                background: "var(--paper-2, #F5F4EF)",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}>
                {["Cuenta", "Tier", "Ventas 7d", "Último login", "País"].map(h => (
                  <th key={h} style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: "var(--ink-4)",
                    borderBottom: "1px solid var(--rule)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <AccountRow_ key={`${row.idFudo}-${i}`} row={row} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Wrapper del Dialog de Radix ─────────────────────────────────────────────

export function AccountsModal({
  open,
  onClose,
  title,
  estado,
  pais,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  estado: EstadoCuenta;
  pais: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => !o && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9998,
          }}
        />
        {/* Panel */}
        <DialogPrimitive.Content
          style={{
            position: "fixed",
            top: "5vh",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(860px, 95vw)",
            height: "88vh",
            background: "var(--paper, #FDFCF8)",
            borderRadius: 16,
            boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <AccountsModalContent title={title} estado={estado} pais={pais} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
