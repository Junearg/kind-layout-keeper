// Métricas derivadas a partir del dataset canónico (filtrado por mes activo).
// Todo lo que se muestra en el dashboard pasa por acá — nada hardcodeado.

import { useMemo } from "react";
import { useDashboardData } from "./liveData";
import { useDatasetState, useForecastAutoNext } from "./dataset-store";
import { mesLargo } from "./schema";

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

export function useDerived() {
  const data = useDashboardData();
  const { dataset, mesActivo } = useDatasetState();
  const forecastAuto = useForecastAutoNext();

  return useMemo(() => {
    const {
      churnTrend, motivosBaja, npsPais, csatMensual, cvrNeto,
      tierDist, motivosDetraccion, motivosPromocion,
    } = data;

    // ─── Tendencia mensual ───
    const closed = churnTrend.filter((m) => !m.proyectado);
    // Si forecast_auto está activo, reemplazamos el valor del primer mes proyectado.
    const projected = churnTrend
      .filter((m) => m.proyectado)
      .map((m, i) => (i === 0 && forecastAuto !== null ? { ...m, bajas: forecastAuto } : m));
    const latestClosed = closed[closed.length - 1] ?? null;
    const prevClosed = closed[closed.length - 2] ?? null;
    const firstClosed = closed[0] ?? null;
    const firstProjected = projected[0] ?? null;

    const ytdClosed = closed.reduce((s, m) => s + (m.bajas ?? 0), 0);
    const totalProjected = projected.reduce((s, m) => s + (m.bajas ?? 0), 0);
    const totalAllSeries = ytdClosed + totalProjected;

    const monthDeltaPct = latestClosed && prevClosed
      ? pctChange(latestClosed.bajas, prevClosed.bajas)
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
    const seriesGrowthPct = firstClosed && (projected[projected.length - 1] ?? latestClosed)
      ? pctChange(
          (projected[projected.length - 1] ?? latestClosed)!.bajas,
          firstClosed.bajas,
        )
      : null;
    const seriesGrowthLabel = seriesGrowthPct !== null
      ? `${seriesGrowthPct >= 0 ? "+" : ""}${Math.round(seriesGrowthPct)}% en ${churnTrend.length - 1} meses`
      : null;

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
    const periodLabel = churnTrend.length
      ? `${stripStar(churnTrend[0]!.mes)}–${stripStar(churnTrend[churnTrend.length - 1]!.mes)}`
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
