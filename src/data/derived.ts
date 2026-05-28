// Métricas derivadas a partir del dataset canónico (filtrado por mes activo).
// Todo lo que se muestra en el dashboard pasa por acá — nada hardcodeado.

import { useMemo } from "react";
import { useDashboardData } from "./liveData";
import { useDatasetState, useForecastAutoNext } from "./dataset-store";
import { mesLargo, mesCorto, type DashboardDataset } from "./schema";

const MES_FULL: Record<string, string> = {
  Ene: "Enero", Feb: "Febrero", Mar: "Marzo", Abr: "Abril",
  May: "Mayo", Jun: "Junio", Jul: "Julio", Ago: "Agosto",
  Sep: "Septiembre", Oct: "Octubre", Nov: "Noviembre", Dic: "Diciembre",
};

function stripStar(m: string) { return m.replace(/\*+$/, "").trim(); }
function mesFull(m: string) {
  const base = stripStar(m);
  return MES_FULL[base] ?? base;
}

function pctChange(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function weightedAvg(items: { value: number; weight: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.weight, 0);
  if (!totalW) return 0;
  return items.reduce((s, i) => s + i.value * i.weight, 0) / totalW;
}

// ─── Tendencia rate-based ──────────────────────────────────────────────
// Pesos WMA: 50% último mes, 30% dos meses atrás, 20% tres meses atrás.
const WMA_WEIGHTS = [0.5, 0.3, 0.2] as const;

export type TrendRatePoint = {
  mes: string;        // label corto (Ene, Feb, …)
  key: string;        // YYYY-MM
  bajas: number;      // bajas reales (cerrado) o proyectadas
  activeBase: number; // cuentas activas al inicio del mes
  rate: number;       // % de churn = bajas / activeBase * 100
  proyectado: boolean;
  bajasMin?: number;
  bajasMax?: number;
  rateMin?: number;
  rateMax?: number;
  // Para Recharts ErrorBar: [delta hacia abajo, delta hacia arriba] absolutos.
  bajasError?: [number, number];
};

export type TrendRate = {
  points: TrendRatePoint[];
  closed: TrendRatePoint[];
  projected: TrendRatePoint[];
  latestRate: number | null;
  wmaRate: number | null;
  stdDev: number;            // desvío estándar (puntos %) de las 3 últimas tasas
  ytdActualClosed: number;   // bajas reales acumuladas del año del mes activo
  totalProjected: number;    // bajas proyectadas en los meses restantes del año
  periodoEstimado: number;   // YTD real + proyección anualizada
};

function nextMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildTrendRate(dataset: DashboardDataset, mesActivo: string): TrendRate {
  // Meses cerrados (con bajas reales) hasta el mes activo, ordenados.
  const cerradosRaw = dataset.tendencia_mensual
    .filter((p) => !p.es_forecast && p.bajas_reales != null && p.mes <= mesActivo)
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const resumenByKey = new Map(dataset.resumen_mensual.map((r) => [r.mes, r]));

  // Base activa al INICIO del mes:
  //   end-of-prev-month si existe; si no, end-of-month + bajas (aprox).
  const closed: TrendRatePoint[] = cerradosRaw.map((p, i) => {
    const bajas = (p.bajas_reales ?? 0);
    const prevKey = i > 0 ? cerradosRaw[i - 1]!.mes : null;
    const endPrev = prevKey ? resumenByKey.get(prevKey)?.cuentas_activas_total ?? null : null;
    const endThis = resumenByKey.get(p.mes)?.cuentas_activas_total ?? null;
    const activeBase = endPrev ?? (endThis != null ? endThis + bajas : 0);
    const rate = activeBase > 0 ? (bajas / activeBase) * 100 : 0;
    return {
      mes: mesCorto(p.mes),
      key: p.mes,
      bajas,
      activeBase,
      rate,
      proyectado: false,
    };
  });

  const latestClosed = closed[closed.length - 1] ?? null;
  const latestRate = latestClosed ? latestClosed.rate : null;

  // WMA y stdDev sobre las últimas 3 tasas cerradas.
  const last3 = closed.slice(-3).map((p) => p.rate);
  let wmaRate: number | null = null;
  if (last3.length > 0) {
    // pesos en orden: más reciente recibe 0.5; rellenamos con 0 si hay menos de 3.
    const padded = [...Array(3 - last3.length).fill(0), ...last3]; // [n-3, n-2, n-1]
    // WMA_WEIGHTS = [0.5, 0.3, 0.2] → último, anteúltimo, antepenúltimo
    // padded está en orden cronológico ascendente, así que invertimos:
    const reversed = [...padded].reverse(); // [n-1, n-2, n-3]
    const totalW = WMA_WEIGHTS.slice(0, last3.length).reduce((s, w) => s + w, 0);
    wmaRate = reversed.reduce((s, v, idx) => s + v * (WMA_WEIGHTS[idx] ?? 0), 0) / (totalW || 1);
  }
  const sd = stdDev(last3);

  // Proyectamos los meses restantes del AÑO del mes activo, comenzando por el
  // siguiente mes al último cerrado. Compounding: cada mes, la base activa
  // baja en la cantidad proyectada del mes anterior.
  const projected: TrendRatePoint[] = [];
  if (latestClosed && wmaRate !== null && latestClosed.activeBase > 0) {
    const year = Number(latestClosed.key.split("-")[0]);
    // base activa al INICIO del primer mes proyectado = end-of-latest-closed
    let baseAtStart =
      resumenByKey.get(latestClosed.key)?.cuentas_activas_total ?? Math.max(0, latestClosed.activeBase - latestClosed.bajas);
    let curKey = nextMonth(latestClosed.key);
    while (Number(curKey.split("-")[0]) === year) {
      const safeBase = Math.max(0, baseAtStart);
      const bajas = Math.max(0, Math.round((safeBase * wmaRate) / 100));
      const rateLow = Math.max(0, wmaRate - sd);
      const rateHigh = wmaRate + sd;
      const bajasMin = Math.max(0, Math.round((safeBase * rateLow) / 100));
      const bajasMax = Math.max(0, Math.round((safeBase * rateHigh) / 100));
      projected.push({
        mes: mesCorto(curKey),
        key: curKey,
        bajas,
        activeBase: safeBase,
        rate: wmaRate,
        proyectado: true,
        bajasMin,
        bajasMax,
        rateMin: rateLow,
        rateMax: rateHigh,
        bajasError: [bajas - bajasMin, bajasMax - bajas],
      });
      baseAtStart = safeBase - bajas;
      curKey = nextMonth(curKey);
    }
  }

  const points = [...closed, ...projected];
  const activeYear = latestClosed ? latestClosed.key.split("-")[0] : mesActivo.split("-")[0];
  const ytdActualClosed = closed
    .filter((p) => p.key.startsWith(`${activeYear}-`))
    .reduce((s, p) => s + p.bajas, 0);
  const totalProjected = projected.reduce((s, p) => s + p.bajas, 0);
  const periodoEstimado = ytdActualClosed + totalProjected;

  return {
    points,
    closed,
    projected,
    latestRate,
    wmaRate,
    stdDev: sd,
    ytdActualClosed,
    totalProjected,
    periodoEstimado,
  };
}


export function useDerived() {
  const data = useDashboardData();
  const { dataset, mesActivo } = useDatasetState();
  const forecastAuto = useForecastAutoNext(); // mantenido por compat (no se usa abajo)
  void forecastAuto;

  return useMemo(() => {
    const {
      churnTrend, motivosBaja, npsPais, csatMensual, cvrNeto,
      tierDist, motivosDetraccion, motivosPromocion,
    } = data;

    // ─── Tendencia rate-based (con WMA + compounding + banda de confianza) ───
    const trendRate = buildTrendRate(dataset, mesActivo);
    const closed = trendRate.closed.map((p) => ({
      mes: p.mes, bajas: p.bajas, pctMotivo: null as number | null, proyectado: false,
    }));
    const projected = trendRate.projected.map((p) => ({
      mes: `${p.mes}*`, bajas: p.bajas, pctMotivo: null as number | null, proyectado: true,
    }));
    const latestClosed = closed[closed.length - 1] ?? null;
    const prevClosed = closed[closed.length - 2] ?? null;
    const firstClosed = closed[0] ?? null;
    const firstProjected = projected[0] ?? null;

    const ytdClosed = trendRate.ytdActualClosed;
    const totalProjected = trendRate.totalProjected;
    const totalAllSeries = trendRate.periodoEstimado;

    const monthDeltaPct = latestClosed && prevClosed
      ? pctChange(latestClosed.bajas, prevClosed.bajas)
      : null;

    // Delta de TASA (puntos porcentuales) último cerrado vs anterior.
    const latestRateP = trendRate.closed[trendRate.closed.length - 1] ?? null;
    const prevRateP = trendRate.closed[trendRate.closed.length - 2] ?? null;
    const monthDeltaRatePts = latestRateP && prevRateP
      ? latestRateP.rate - prevRateP.rate
      : null;

    const projectionDeltaPct = firstProjected && latestClosed
      ? pctChange(firstProjected.bajas, latestClosed.bajas)
      : null;

    // Aceleración Feb→último cerrado (si existe Feb)
    const feb = closed.find((m) => stripStar(m.mes).toLowerCase().startsWith("feb"));
    const accelFebToLatest = feb && latestClosed && feb !== latestClosed
      ? pctChange(latestClosed.bajas, feb.bajas)
      : null;
    const accelLabel = accelFebToLatest !== null && feb && latestClosed
      ? `${accelFebToLatest >= 0 ? "+" : ""}${accelFebToLatest.toFixed(1)}% ${stripStar(feb.mes)}→${stripStar(latestClosed.mes)}`
      : null;

    // Crecimiento de toda la serie (primero cerrado → último proyectado)
    const lastProj = projected[projected.length - 1] ?? latestClosed;
    const seriesGrowthPct = firstClosed && lastProj
      ? pctChange(lastProj.bajas, firstClosed.bajas)
      : null;
    const seriesLen = trendRate.points.length;
    const seriesGrowthLabel = seriesGrowthPct !== null
      ? `${seriesGrowthPct >= 0 ? "+" : ""}${Math.round(seriesGrowthPct)}% en ${Math.max(1, seriesLen - 1)} meses`
      : null;
    void churnTrend; // legacy shape ya no se consume desde acá; se reconstruye desde trendRate

    // ─── Motivos / brecha ───
    const totalCategorizadas = motivosBaja.reduce((s, m) => s + m.n, 0);
    // brecha = motivo marcado como brecha (suele ser "sin motivo")
    const sinMotivo = motivosBaja.find((m) => m.brecha) ?? motivosBaja[0] ?? null;
    const pctSinMotivo = sinMotivo
      ? (totalCategorizadas ? (sinMotivo.n / totalCategorizadas) * 100 : sinMotivo.pct)
      : 0;

    // ─── NPS ───
    const npsResponses = npsPais.reduce((s, p) => s + p.n, 0);
    const npsBaseAccounts = npsPais.reduce((s, p) => s + p.cuentas, 0);
    const npsGlobal = weightedAvg(npsPais.map((p) => ({ value: p.nps, weight: p.n })));
    const promPct = weightedAvg(npsPais.map((p) => ({ value: p.promotores, weight: p.n })));
    const detrPct = weightedAvg(npsPais.map((p) => ({ value: p.detractores, weight: p.n })));
    const pasPct = Math.max(0, 100 - promPct - detrPct);
    const npsPromotoresCount = Math.round(npsResponses * promPct / 100);
    const npsDetractoresCount = Math.round(npsResponses * detrPct / 100);
    const npsPasivosCount = Math.max(0, npsResponses - npsPromotoresCount - npsDetractoresCount);

    const npsSorted = [...npsPais].sort((a, b) => a.nps - b.nps);
    const npsWorst = npsSorted[0] ?? null;
    const npsBest = npsSorted[npsSorted.length - 1] ?? null;
    const npsAvg = npsGlobal;
    const npsGap = npsWorst && npsBest ? npsBest.nps - npsWorst.nps : 0;

    const detraccionTop = motivosDetraccion[0] ?? null;
    const promocionTop = motivosPromocion[0] ?? null;
    // Cruce paradoja: ¿el motivo top de detracción aparece en promoción?
    const costoEnAmbos = (() => {
      if (!detraccionTop) return null;
      const idx = motivosPromocion.findIndex((p) =>
        p.motivo.toLowerCase().includes(detraccionTop.motivo.toLowerCase().split(" ")[0]!.slice(0, 4))
      );
      if (idx < 0) return null;
      const detRank = motivosDetraccion.findIndex((d) => d.motivo === detraccionTop.motivo) + 1;
      return { detRank, promRank: idx + 1, motivo: detraccionTop.motivo };
    })();

    // ─── CSAT ───
    const csatClosed = csatMensual.filter((m) => m.churnMes !== null && m.churnMes !== undefined);
    const csatLatest = csatClosed[csatClosed.length - 1] ?? csatMensual[csatMensual.length - 1] ?? null;
    const csatAvg = csatMensual.length
      ? csatMensual.reduce((s, m) => s + (m.avg ?? 0), 0) / csatMensual.length
      : 0;
    const csatTotalConv = csatMensual.reduce((s, m) => s + (m.conversaciones ?? 0), 0);

    // ─── CVR ───
    const cvrLatest = cvrNeto[cvrNeto.length - 1] ?? null;

    // ─── Tiers / cuentas activas ───
    const activeAccounts = tierDist.reduce((s, t) => s + t.count, 0);
    const champion = tierDist.find((t) => t.tier === "Champion") ?? null;
    const healthy = tierDist.find((t) => t.tier === "Healthy") ?? null;
    const atRisk = tierDist.find((t) => t.tier === "At Risk") ?? null;
    const critical = tierDist.find((t) => t.tier === "Critical") ?? null;

    // ─── Última actualización (desde meta del dataset) ───
    const uploadedAt = dataset.meta.uploaded_at;
    const lastUpdate = uploadedAt
      ? new Date(uploadedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

    // ─── Variación de cuentas mes vs mes desde resumen_mensual ───
    const resumenSorted = [...dataset.resumen_mensual].sort((a, b) => a.mes.localeCompare(b.mes));
    const idxAct = resumenSorted.findIndex((r) => r.mes === mesActivo);
    const resAct = idxAct >= 0 ? resumenSorted[idxAct]! : null;
    const resPrev = idxAct > 0 ? resumenSorted[idxAct - 1]! : null;
    const snapDelta = resAct && resPrev
      ? resAct.cuentas_activas_total - resPrev.cuentas_activas_total
      : null;
    const snapLatestLabel = resAct ? mesLargo(resAct.mes) : null;
    const snapPrevLabel = resPrev ? mesLargo(resPrev.mes) : null;

    // ─── Etiquetas de período ───
    const closedMonthsLabel = firstClosed && latestClosed
      ? `${stripStar(firstClosed.mes)}→${stripStar(latestClosed.mes)} · ${closed.length} meses`
      : null;
    const periodLabel = trendRate.points.length
      ? `${stripStar(trendRate.points[0]!.mes)}–${stripStar(trendRate.points[trendRate.points.length - 1]!.mes)}`
      : "";


    // Ratio de altos detractores por costo (sumamos % de "costo" en detracción)
    const detrCostoPct = motivosDetraccion
      .filter((m) => /costo|precio/i.test(m.motivo))
      .reduce((s, m) => s + m.pct, 0);

    return {
      // tendencia
      latestClosed, prevClosed, firstClosed, firstProjected,
      latestClosedFull: latestClosed ? mesFull(latestClosed.mes) : "",
      ytdClosed, totalProjected, totalAllSeries,
      monthDeltaPct, projectionDeltaPct,
      accelFebToLatest, accelLabel,
      seriesGrowthPct, seriesGrowthLabel,
      closedMonthsLabel, periodLabel,

      // motivos
      sinMotivo, pctSinMotivo, totalCategorizadas,

      // NPS
      npsResponses, npsBaseAccounts, npsGlobal,
      npsPromotoresCount, npsPasivosCount, npsDetractoresCount,
      npsPromotoresPct: promPct, npsPasivosPct: pasPct, npsDetractoresPct: detrPct,
      npsWorst, npsBest, npsAvg, npsGap,
      detraccionTop, promocionTop, costoEnAmbos, detrCostoPct,

      // CSAT / CVR
      csatLatest, csatAvg, csatTotalConv,
      cvrLatest,

      // tiers
      activeAccounts, champion, healthy, atRisk, critical,

      // variación mes vs mes
      latestSnap: resAct, prevSnap: resPrev, snapDelta, snapLatestLabel, snapPrevLabel,

      // misc
      lastUpdate,
    };
  }, [data, dataset, mesActivo, forecastAuto]);
}

export type Derived = ReturnType<typeof useDerived>;
