import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";

export const Route = createFileRoute("/labs")({
  head: () => ({ meta: [{ title: "Labs · Fudo Customer Center" }] }),
  component: Labs,
});

const fmtMoney = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString("es-AR")}`;
};
const fmtNum = (n: number) => Math.round(n).toLocaleString("es-AR");

const FOOTER_NOTE = "Calculado sobre N=6,191 cuentas churneadas (Nov 2025 – Abr 2026)";

function LabCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        position: "relative",
        background: "var(--card)",
        border: "1px solid var(--rule)",
        borderRadius: 16,
        padding: 28,
        marginBottom: 24,
      }}
    >
      <span style={{
        position: "absolute", top: 18, right: 20, fontSize: 10, fontWeight: 700,
        letterSpacing: 1, padding: "3px 8px", borderRadius: 6,
        background: "var(--orange-soft)", color: "var(--orange-deep)",
      }}>⚗ BETA</span>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{title}</h2>
      <p className="muted" style={{ marginTop: 6, marginBottom: 22, fontSize: 13.5, maxWidth: 720 }}>{desc}</p>
      {children}
      <div className="muted fs-11" style={{ marginTop: 20, paddingTop: 14, borderTop: "1px dashed var(--rule)" }}>
        {FOOTER_NOTE}
      </div>
    </section>
  );
}

function StatCard({ label, value, hint, tone = "ink" }: { label: string; value: string; hint?: string; tone?: "ink" | "orange" | "amber" | "red" }) {
  const color = tone === "orange" ? "var(--orange)" : tone === "amber" ? "var(--amber)" : tone === "red" ? "var(--red)" : "var(--ink)";
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 12, padding: 16, background: "var(--paper)" }}>
      <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      {hint && <div className="muted fs-11" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, suffix = "%" }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="fs-12" style={{ color: "var(--ink-2)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)" }}>{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--orange)" }}
      />
      <div className="muted fs-11" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{min}{suffix}</span><span>{max}{suffix}</span>
      </div>
    </div>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              textAlign: i === 0 ? "left" : "right", padding: "8px 10px",
              borderBottom: "1px solid var(--rule)", color: "var(--ink-3)",
              fontWeight: 600, textTransform: "uppercase", fontSize: 10.5, letterSpacing: 0.5,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{
                padding: "9px 10px", borderBottom: "1px solid var(--rule)",
                textAlign: j === 0 ? "left" : "right",
                color: j === 0 ? "var(--ink)" : "var(--ink-2)",
                fontWeight: j === 0 ? 500 : 400,
                fontVariantNumeric: j > 0 ? "tabular-nums" : undefined,
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ───────────── Lab 1 ───────────── */
function Lab1() {
  const [intercept, setIntercept] = useState(20);
  const [retain, setRetain] = useState(40);
  const TOTAL = 652;
  const GMV_TOTAL = 21_520_000;
  const AVG_MONTHLY_EVITABLE_GMV = GMV_TOTAL / 6;

  const cuentasRescatadas = Math.round(TOTAL * intercept / 100);
  const gmvRecuperado = GMV_TOTAL * (intercept / 100) * (retain / 100);
  const mesesCubiertos = (gmvRecuperado / AVG_MONTHLY_EVITABLE_GMV).toFixed(1);

  return (
    <LabCard
      title="¿Cuánto GMV podríamos recuperar?"
      desc="652 cuentas se fueron por motivos evitables (precio, dejó de usar, eligió otro sistema). Jugá con los sliders para ver el impacto de interceptarlas a tiempo."
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        <div>
          <div style={{
            background: "var(--orange-soft)", border: "1px solid var(--orange-tint)",
            borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 12.5, color: "var(--orange-deep)",
          }}>
            <strong>468 cuentas evitables ($15.77M)</strong> se fueron sin que nadie las contactara nunca.
          </div>
          <Slider label="% de cuentas que podríamos interceptar" min={5} max={80} step={5} value={intercept} onChange={setIntercept} />
          <Slider label="% de esas que lograríamos retener" min={10} max={70} step={10} value={retain} onChange={setRetain} />

          <div style={{
            marginTop: 24, padding: 20, background: "var(--paper)",
            border: "1px solid var(--rule)", borderRadius: 12, textAlign: "center",
          }}>
            <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>GMV recuperado</div>
            <div style={{
              fontSize: 48, fontWeight: 800, color: "var(--orange)", lineHeight: 1.1,
              marginTop: 6, transition: "color 0.2s",
            }}>{fmtMoney(gmvRecuperado)}</div>
            <div className="muted fs-12" style={{ marginTop: 8 }}>
              {fmtNum(cuentasRescatadas)} cuentas rescatadas · equivale a <strong>{mesesCubiertos} meses</strong> de churn evitable cubierto
            </div>
          </div>
        </div>

        <div>
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Por país</div>
          <MiniTable
            headers={["País", "Cuentas", "GMV en riesgo"]}
            rows={[
              ["Chile", 205, "$7.75M"],
              ["Argentina", 160, "$6.87M"],
              ["Colombia", 63, "$6.82M"],
              ["México", 111, "$0.08M"],
            ]}
          />
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginTop: 22, marginBottom: 8 }}>Top ejecutivos</div>
          <MiniTable
            headers={["Ejecutivo", "Cuentas", "GMV"]}
            rows={[
              ["Orianna Chacon", 42, "$4.07M"],
              ["Erika Abreu", 25, "$2.74M"],
              ["Andrés Orellana", 67, "$2.63M"],
              ["Exequiel Galarza", 53, "$2.28M"],
              ["Ysrael Ortega", 43, "$1.58M"],
              ["Florencia Fanego", 31, "$1.32M"],
            ]}
          />
        </div>
      </div>
    </LabCard>
  );
}

/* ───────────── Lab 2 ───────────── */
type ProdFilter = "none" | "30" | "50" | "100";
type UserFilter = "none" | "1" | "2";
type ContactFilter = "none" | "sin" | "con";
type ArqueoFilter = "none" | "0";

function Lab2() {
  const [prod, setProd] = useState<ProdFilter>("50");
  const [users, setUsers] = useState<UserFilter>("2");
  const [contact, setContact] = useState<ContactFilter>("sin");
  const [arqueo, setArqueo] = useState<ArqueoFilter>("none");

  const BASE = 6191;

  const result = useMemo(() => {
    // Lookup keyed by sorted active filters
    type Entry = { n: number; evitable: number; gmv: number };
    const SINGLE: Record<string, Entry> = {
      "prod<30":   { n: 1012, evitable: 0.127, gmv: 29_500_000 },
      "prod<50":   { n: 1644, evitable: 0.115, gmv: 51_000_000 },
      "prod<100":  { n: 3043, evitable: 0.109, gmv: 96_600_000 },
      "users<=1":  { n: 1019, evitable: 0.087, gmv: 32_300_000 },
      "users<=2":  { n: 2645, evitable: 0.107, gmv: 82_600_000 },
      "sincontacto": { n: 4981, evitable: 0.094, gmv: 170_500_000 },
      "concontacto": { n: 1064, evitable: 0.127, gmv: 43_400_000 },
      "arqueo=0":  { n: 3865, evitable: 0.109, gmv: 123_200_000 },
    };
    const COMBOS: Record<string, Entry> = {
      "sincontacto+prod<50": { n: 1366, evitable: 0.103, gmv: 41_900_000 },
      "users<=2+sincontacto": { n: 2224, evitable: 0.097, gmv: 68_200_000 },
      "users<=2+prod<50+sincontacto": { n: 1003, evitable: 0.104, gmv: 30_000_000 },
      "sincontacto+arqueo=0": { n: 3195, evitable: 0.100, gmv: 99_800_000 },
    };

    const keys: string[] = [];
    if (prod !== "none") keys.push(`prod<${prod}`);
    if (users !== "none") keys.push(`users<=${users}`);
    if (contact === "sin") keys.push("sincontacto");
    if (contact === "con") keys.push("concontacto");
    if (arqueo === "0") keys.push("arqueo=0");

    if (keys.length === 0) {
      return { n: BASE, evitable: 0.106, gmv: 213_800_000, exact: true };
    }
    if (keys.length === 1) {
      const e = SINGLE[keys[0]];
      return { ...e, exact: true };
    }
    const comboKey = keys.sort().join("+");
    if (COMBOS[comboKey]) return { ...COMBOS[comboKey], exact: true };

    // Proportional: multiply rates relative to base
    let n = BASE;
    let gmv = 213_800_000;
    let evitableRate = 0.106;
    for (const k of keys) {
      const e = SINGLE[k];
      n = n * (e.n / BASE);
      gmv = gmv * (e.gmv / 213_800_000);
      evitableRate = (evitableRate + e.evitable) / 2;
    }
    return { n: Math.round(n), evitable: evitableRate, gmv, exact: false };
  }, [prod, users, contact, arqueo]);

  const pctBase = (result.n / BASE) * 100;
  const evitableCount = Math.round(result.n * result.evitable);

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 8, border: "1px solid var(--rule-2)",
    background: "var(--paper)", fontSize: 13, color: "var(--ink)",
    fontFamily: "inherit", cursor: "pointer", width: "100%",
  };

  return (
    <LabCard
      title="Diseñá tu regla de early warning"
      desc="Basado en el historial de 6,191 cuentas churneadas. Combiná señales para armar tu criterio de intervención y ver cuántas cuentas habrían calificado — y cuántas de esas eran churn evitable."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        <label>
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Productos cargados</div>
          <select value={prod} onChange={(e) => setProd(e.target.value as ProdFilter)} style={selectStyle}>
            <option value="none">Sin filtro</option>
            <option value="30">&lt; 30</option>
            <option value="50">&lt; 50</option>
            <option value="100">&lt; 100</option>
          </select>
        </label>
        <label>
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Usuarios activos</div>
          <select value={users} onChange={(e) => setUsers(e.target.value as UserFilter)} style={selectStyle}>
            <option value="none">Sin filtro</option>
            <option value="1">≤ 1</option>
            <option value="2">≤ 2</option>
          </select>
        </label>
        <label>
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Contacto CS</div>
          <select value={contact} onChange={(e) => setContact(e.target.value as ContactFilter)} style={selectStyle}>
            <option value="none">Sin filtro</option>
            <option value="sin">Sin ningún contacto</option>
            <option value="con">Con al menos 1</option>
          </select>
        </label>
        <label>
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Arqueos realizados</div>
          <select value={arqueo} onChange={(e) => setArqueo(e.target.value as ArqueoFilter)} style={selectStyle}>
            <option value="none">Sin filtro</option>
            <option value="0">= 0</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <StatCard label="Cuentas que habrían calificado" value={fmtNum(result.n)} hint={`${pctBase.toFixed(1)}% de la base`} tone="ink" />
        <StatCard label="De esas, churn evitable" value={fmtNum(evitableCount)} hint={`${(result.evitable * 100).toFixed(1)}%`} tone="orange" />
        <StatCard label="GMV en riesgo cubierto" value={fmtMoney(result.gmv)} hint={result.exact ? "Combinación medida" : "Estimación proporcional"} tone="ink" />
      </div>

      <div style={{
        marginTop: 18, background: "#FDF4E7", border: "1px solid #F0DCB4",
        borderRadius: 10, padding: 14, fontSize: 13, color: "var(--amber)",
      }}>
        Cuanto más restrictiva la regla, mayor precisión pero menor cobertura. El punto óptimo suele estar entre el 15–25% de la base.
      </div>
    </LabCard>
  );
}

/* ───────────── Lab 3 ───────────── */
function Lab3() {
  const [base, setBase] = useState(35000);
  const [goal, setGoal] = useState(3.0);
  const BAJAS_ACTUAL = 1313;

  const mensual = (BAJAS_ACTUAL / base) * 100;
  const anual = mensual * 12;
  const proy = [
    { mes: "Mayo", bajas: 1400 },
    { mes: "Junio", bajas: 1487 },
    { mes: "Julio", bajas: 1575 },
  ].map(p => ({ ...p, rate: (p.bajas / base) * 100 }));

  const bajasMeta = Math.round((goal / 100) * base);
  const retenerMas = BAJAS_ACTUAL - bajasMeta;

  return (
    <LabCard
      title="¿Cuál es tu churn rate real?"
      desc="El número de bajas es claro. El churn rate depende de cuántas cuentas activas tenés. Ingresá tu base activa y calculamos el resto."
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Base activa actual</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setBase(Math.max(1000, base - 1000))} style={btnStep}>−</button>
          <input
            type="number" value={base} step={1000}
            onChange={(e) => setBase(Math.max(1000, Number(e.target.value) || 0))}
            style={{
              width: 180, padding: "10px 14px", fontSize: 22, fontWeight: 700,
              textAlign: "center", border: "1px solid var(--rule-2)", borderRadius: 10,
              background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
            }}
          />
          <button onClick={() => setBase(base + 1000)} style={btnStep}>+</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <StatCard label="Churn rate mensual" value={`${mensual.toFixed(2)}%`} hint={`${fmtNum(BAJAS_ACTUAL)} bajas / ${fmtNum(base)} cuentas`} tone="orange" />
        <StatCard label="Anualizado" value={`${anual.toFixed(1)}%`} hint="mensual × 12" tone="ink" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }}>
        {proy.map(p => (
          <StatCard key={p.mes} label={`Proyección ${p.mes}`} value={`${p.rate.toFixed(2)}%`} hint={`~${fmtNum(p.bajas)} bajas`} />
        ))}
      </div>

      <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Histórico</div>
      <MiniTable
        headers={["Mes", "Bajas reales", "GMV perdido"]}
        rows={[
          ["Nov 2025", 863, "$29.0M"],
          ["Dic 2025", 928, "$33.8M"],
          ["Ene 2026", 904, "$33.0M"],
          ["Feb 2026", 1029, "$35.2M"],
          ["Mar 2026", 1154, "$38.8M"],
          ["Abr 2026", 1313, "$43.9M"],
        ]}
      />

      <div style={{
        marginTop: 22, padding: 18, background: "var(--paper)",
        border: "1px solid var(--rule)", borderRadius: 12,
      }}>
        <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Meta de churn rate</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            type="number" step={0.1} min={0.1} value={goal}
            onChange={(e) => setGoal(Math.max(0.1, Number(e.target.value) || 0))}
            style={{
              width: 110, padding: "8px 12px", fontSize: 16, fontWeight: 600,
              textAlign: "center", border: "1px solid var(--rule-2)", borderRadius: 8,
              background: "white", fontFamily: "inherit",
            }}
          />
          <span className="fs-13" style={{ color: "var(--ink-2)" }}>%</span>
          <span className="fs-13 muted">→</span>
          <span style={{ fontSize: 14, color: "var(--ink)" }}>
            Necesitarías bajar a <strong style={{ color: "var(--orange)" }}>{fmtNum(bajasMeta)} bajas/mes</strong>
            {retenerMas > 0 && <>. Retener <strong>{fmtNum(retenerMas)} cuentas más</strong> por mes vs. la tendencia actual.</>}
            {retenerMas <= 0 && <>. Ya estás por debajo de esa meta.</>}
          </span>
        </div>
      </div>
    </LabCard>
  );
}

const btnStep: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 8, border: "1px solid var(--rule-2)",
  background: "var(--paper)", fontSize: 20, cursor: "pointer", fontFamily: "inherit",
  color: "var(--ink-2)",
};

/* ───────────── Lab 4 ───────────── */
function Lab4() {
  const [shift, setShift] = useState(15);

  const dist = [
    { ventana: "0–7 días", count: 4, color: "var(--red)", maxDays: 7 },
    { ventana: "8–14 días", count: 22, color: "var(--red)", maxDays: 14 },
    { ventana: "15–30 días", count: 192, color: "var(--amber)", maxDays: 30 },
    { ventana: "31–60 días", count: 420, color: "#3B8E5C", maxDays: 60 },
    { ventana: "61–90 días", count: 178, color: "#3B8E5C", maxDays: 90 },
    { ventana: "91–180 días", count: 57, color: "var(--blue)", maxDays: 180 },
  ];
  // Per spec: contactadas en últimos 7 días = 937 (uses different cohort), distribution above is the more granular one
  const max = Math.max(...dist.map(d => d.count));

  // accounts that would have moved from red/amber (<=30d) into >30 if shifted earlier by N days
  // Approximate: any in 0-30 cohort whose maxDays + shift > 30 moves to green
  const movedToGreen = dist
    .filter(d => d.maxDays <= 30 && d.maxDays + shift > 30)
    .reduce((s, d) => s + d.count, 0);

  return (
    <LabCard
      title="¿Llegamos a tiempo?"
      desc="1,806 cuentas tuvieron al menos un contacto antes de darse de baja. Analizamos en qué momento llegó ese contacto — y si aún había ventana para retenerlas."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        <StatCard label="Mediana días último contacto → baja" value="1 día" hint="el contacto llega tarde" tone="red" />
        <StatCard label="Contactadas últimos 7 días" value="937" hint="antes de bajar" tone="amber" />
        <StatCard label="Contactadas últimos 30 días" value={fmtNum(1151)} hint="antes de bajar" />
        <StatCard label='Mencionaron "baja" y se fueron' value="220" hint="$8.8M GMV" tone="red" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        <div>
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Distribución: días entre último contacto y baja</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dist.map(d => (
              <div key={d.ventana} style={{ display: "grid", gridTemplateColumns: "100px 1fr 60px", alignItems: "center", gap: 10 }}>
                <span className="fs-12" style={{ color: "var(--ink-2)" }}>{d.ventana}</span>
                <div style={{ background: "var(--paper-2)", borderRadius: 4, height: 22, position: "relative", overflow: "hidden" }}>
                  <div style={{
                    width: `${(d.count / max) * 100}%`, height: "100%",
                    background: d.color, borderRadius: 4, transition: "width 0.3s",
                  }} />
                </div>
                <span className="mono" style={{ fontSize: 12, textAlign: "right", color: "var(--ink-2)" }}>{d.count}</span>
              </div>
            ))}
          </div>
          <div className="fs-11 muted" style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--red)", borderRadius: 2, marginRight: 4 }} />0–14 muy tarde</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--amber)", borderRadius: 2, marginRight: 4 }} />15–30 tarde</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#3B8E5C", borderRadius: 2, marginRight: 4 }} />31–90 ventana útil</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--blue)", borderRadius: 2, marginRight: 4 }} />91+ preventivo</span>
          </div>

          <div style={{ marginTop: 22, padding: 16, background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 10 }}>
            <Slider
              label={`Si hubiéramos contactado N días antes`}
              min={0} max={60} step={5} value={shift} onChange={setShift} suffix=" días"
            />
            <div className="fs-13" style={{ color: "var(--ink-2)", marginTop: 4 }}>
              <strong style={{ color: "var(--orange)", fontSize: 18 }}>{fmtNum(movedToGreen)}</strong> cuentas habrían pasado de la zona roja/ámbar a tener una ventana real de intervención (&gt;30 días).
            </div>
          </div>
        </div>

        <div>
          <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Tema del último contacto</div>
          <MiniTable
            headers={["Tema", "Frec."]}
            rows={[
              ["Consulta comercial", 649],
              ["Impresoras", 485],
              ["Mi cuenta", 348],
              ["No gestionadas", 164],
              ["Productos", 140],
              ["Facturación", 138],
              ["Fudopagos", 121],
              ["Ventas", 109],
              ["Aplicaciones de Delivery", 102],
            ]}
          />
        </div>
      </div>

      <div style={{
        marginTop: 24, background: "var(--ink)", color: "var(--paper)",
        borderRadius: 14, padding: 24,
      }}>
        <div className="mono fs-11" style={{ opacity: 0.6, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>El insight</div>
        <div style={{ fontSize: 20, lineHeight: 1.4, fontWeight: 500 }}>
          El 57% de los contactos llegaron en los últimos 7 días antes de la baja.
          <span style={{ color: "var(--orange)" }}> La intervención reactiva no retiene — informa la salida.</span>
        </div>
      </div>
    </LabCard>
  );
}

/* ───────────── Page ───────────── */
function Labs() {
  return (
    <Layout>
      <Lab1 />
      <Lab2 />
      <Lab3 />
      <Lab4 />
    </Layout>
  );
}
