## Objetivo

Reemplazar el modelo de datos actual (mockData + overrides ad-hoc) por un **modelo canónico mensual** alimentado 100% desde un XLSX que el equipo sube cada mes. Todo el dashboard se recalcula desde ese archivo + un **selector de mes** global.

---

## 1) Auditoría de hardcodes (entregable previo a refactor)

Voy a barrer estos archivos y producir un reporte breve marcando qué se queda (UI/labels/colores/umbrales) vs qué pasa a datos importados:

- `src/data/mockData.ts` → **todo a datos importados** (es la fuente actual de hardcodes).
- `src/data/derived.ts` → revisar fórmulas, mantener como capa de cálculo pero alimentada por el nuevo store.
- `src/routes/resumen.tsx`, `tendencia.tsx`, `nps.tsx`, `health.tsx`, `cola.tsx`, `kpis.tsx` → buscar números/strings literales de negocio (alertas tipo "Chile", "Feb→Abr", proyecciones, %). Todos pasan a derivarse.
- `src/components/Layout.tsx` → "última actualización" debe venir del archivo, no de `Date.now()`.
- `src/lib/export-workbook.ts`, `src/lib/parse-workbook.ts` → reescribir alrededor del nuevo esquema de 7 hojas.

Se queda hardcodeado solo: textos de UI (títulos, tooltips), tokens de color (`src/styles.css`), y **umbrales de alerta** centralizados en un único `src/lib/alert-rules.ts` (configurables, documentados).

Entrego el reporte como comentario en chat antes de tocar el modelo.

---

## 2) Nuevo modelo de datos canónico

Archivo nuevo: `src/data/schema.ts` con los tipos exactos de las 7 hojas que pediste (resumen_mensual, tendencia_mensual, motivos_baja, nps {global, por_pais, mirror_motivos}, health_score {tiers_resumen, risk_flags, cuentas_activas}, cola_cs, kpis_iniciativas {kpis, iniciativas}).

Tipo raíz:

```ts
type DashboardDataset = {
  meta: { uploaded_at: string; source_filename: string; meses_disponibles: string[] };
  resumen_mensual: ResumenMes[];
  tendencia_mensual: TendenciaPunto[];
  motivos_baja: MotivoBaja[];     // multi-mes, se filtra por mes activo
  nps: { global: NpsGlobal[]; por_pais: NpsPais[]; mirror_motivos: NpsMirrorMotivo[] };
  health_score: { tiers_resumen: TierResumen[]; risk_flags: RiskFlag[]; cuentas_activas: CuentaActiva[] };
  cola_cs: CuentaCola[];
  kpis_iniciativas: { kpis: Kpi[]; iniciativas: Iniciativa[] };
};
```

---

## 3) Store global (período activo + dataset)

Archivo nuevo: `src/data/dataset-store.ts` (zustand + persist en `localStorage`).

- `dataset: DashboardDataset | null`
- `mesActivo: string` (default = último mes con datos en `resumen_mensual`)
- `setDataset(d)`, `setMesActivo(m)`, `clear()`
- Hooks selectores: `useMesActivo()`, `useResumenMes()`, `useMotivosMes()`, `useNpsMes()`, `useHealthMes()`, `useColaMes()`, `useKpisMes()` — cada uno devuelve los datos del mes activo o `null` si no hay.

Reemplaza a `liveData.ts` (lo dejo como shim deprecado por compatibilidad y migro cada ruta).

---

## 4) Plantilla XLSX descargable

Reescribo `src/lib/export-workbook.ts` → `src/lib/template-workbook.ts` (la export-actual del dataset queda en otro file).

Genera XLSX con **8 hojas**:
1. **INSTRUCCIONES** (primera): tabla con `hoja | campo | tipo | obligatorio | ejemplo | descripción` para los ~120 campos. Header con freeze + estilos.
2. `resumen_mensual` — headers + 1 fila ejemplo (Abril 2026).
3. `tendencia_mensual` — 6 meses reales + 2 forecast de ejemplo.
4. `motivos_baja` — 6 motivos ejemplo del mes.
5. `nps_global` + `nps_por_pais` + `nps_mirror_motivos` (3 hojas o 1 con secciones — uso 3 hojas para parsing simple).
6. `health_tiers`, `health_flags`, `health_cuentas` (3 hojas).
7. `cola_cs`.
8. `kpis`, `iniciativas` (2 hojas).

→ Realmente quedan ~13 pestañas. Las nombro con prefijo (`01_resumen`, `02_tendencia`…) para orden visual. Mantengo en INSTRUCCIONES el mapeo nombre→propósito.

Tipos clave validados con data-validation de xlsx (listas desplegables para `prioridad`, `tier`, `tendencia_dir`, `estado`).

Botón "Descargar plantilla XLSX" en `/importar`.

---

## 5) Parser + validador

Reescribo `src/lib/parse-workbook.ts`:

- Para cada hoja, definición declarativa: `{ sheetName, required, fields: [{key, header, type, required, enum?}] }`.
- Parseo con `XLSX.utils.sheet_to_json` + cast por tipo (number/string/boolean/string[] separado por `,` o `|`).
- Devuelve `{ dataset, report }` donde report = `{ hoja, filas, columnas_encontradas, campos_faltantes[], filas_con_errores[{fila, campo, motivo}] }`.

Hojas faltantes → warning, no error. La app debe funcionar con datos parciales (regla del usuario).

---

## 6) Pantalla `/importar` rehecha

`src/routes/importar.tsx`:

- Card 1: **Descargar plantilla XLSX** (botón).
- Card 2: **Dropzone** (drag&drop + click). Al soltar archivo:
  - Parse en browser.
  - Tabla preview por hoja: filas / columnas / campos faltantes / errores.
  - Botón **"Confirmar e importar"** → guarda en store + localStorage + setea `meta.uploaded_at = file.lastModified` y `source_filename`.
- Card 3: estado actual (último import, meses disponibles, botón **"Limpiar datos"**).

---

## 7) Header: última actualización + selector de mes

`src/components/Layout.tsx`:

- Reemplazo el badge de "Actualizado…" por `meta.uploaded_at` formateado.
- **Selector `<select>`** con `meses_disponibles` (label en español: "Abril 2026"). Cambiar mes recomputa todo el dashboard reactivamente.
- Si no hay dataset cargado → CTA "Importar datos" que linkea a `/importar`.
- Buscador sigue funcionando, pero filtra sobre `cuentas_activas` del mes activo.

---

## 8) Migración de cada ruta al nuevo store

Cada `route.tsx` consume sus selectores y, si `null`, muestra **"Sin datos para este período"** (componente nuevo `<EmptyPeriod section="NPS" />`).

- `resumen.tsx`: usa `useResumenMes()`. Todos los KPI cards, proyección y alertas vienen del registro del mes.
- `tendencia.tsx`: `tendencia_mensual` completa, marca `es_forecast` con estilo dashed.
- `nps.tsx`: `nps.global/por_pais/mirror_motivos` del mes.
- `health.tsx`: tiers_resumen + risk_flags + cuentas_activas del mes.
- `cola.tsx`: `cola_cs` del mes.
- `kpis.tsx`: `kpis` + `iniciativas` del mes (iniciativas no filtran por mes — son globales).

---

## 9) Alertas auto-derivadas

Archivo nuevo: `src/lib/alert-rules.ts` — único lugar con umbrales:

```ts
export const ALERT_THRESHOLDS = {
  npsPaisGapVsLider: 10,     // alerta si país < líder − 10
  pctSinMotivoCritico: 50,   // %
  aceleracionPctCritico: 30, // %
  riskFlagCriticalTier: ['Critical'],
};
```

Función `computeAlertas(dataset, mes)` que devuelve `Alerta[]` consumidos por `resumen.tsx` y `AlertBanner`. Reemplaza los strings tipo "Chile −18" hardcodeados.

---

## 10) Compatibilidad

- Mantengo `mockData.ts` solo como **seed inicial** convertido al nuevo esquema, para que la app no quede vacía en primera carga (dataset por defecto cargado en el store si no hay localStorage).
- `liveData.ts` / `derived.ts` viejos: borro tras migrar todas las rutas.
- `ExportButton`: lo apunto a un nuevo `export-current-dataset.ts` que serializa el dataset cargado al mismo formato del template (round-trip import↔export).

---

## Orden de implementación

1. Reporte de auditoría (chat).
2. `schema.ts` + `dataset-store.ts` + `alert-rules.ts`.
3. Seed: convertir mockData actual → `seed-dataset.ts` en el nuevo formato (1 mes mínimo).
4. `template-workbook.ts` + `parse-workbook.ts` nuevos.
5. `/importar` rehecho.
6. `Layout.tsx`: selector de mes + última actualización.
7. Migrar las 6 rutas + `<EmptyPeriod>`.
8. Reemplazar alertas hardcodeadas por `computeAlertas`.
9. Borrar `mockData.ts`/`liveData.ts`/`derived.ts` viejos.

---

## Riesgos / decisiones que necesito confirmar

- **Formato de archivo**: dijiste "JSON o CSV", pero el detalle es XLSX (multi-hoja). Confirmo que voy con **XLSX** (ya hay infra SheetJS + es lo único que soporta 7+ hojas de forma usable). ¿OK?
- **Iniciativas**: las definiste sin campo `mes`. Las trato como **globales** (no filtran por período). ¿OK?
- **Cuentas activas vs cola_cs**: hay solapamiento (cola_cs es subset de cuentas_activas con prio_cs ≥ 35). ¿Querés que la cola se **derive** automáticamente desde `health_cuentas` (más simple para el equipo) o que el equipo cargue la hoja `cola_cs` aparte (como pediste)? Por defecto implemento las dos: si la hoja viene cargada se respeta, si no, se deriva.
- **Forecast** en `tendencia_mensual`: lo carga el equipo manualmente en la plantilla (no lo calculo). ¿OK?

Confirmame esos 4 puntos y arranco. Es trabajo grande (≈15-20 archivos tocados/creados) — lo hago en una sola pasada.