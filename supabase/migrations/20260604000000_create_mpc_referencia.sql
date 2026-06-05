-- Tabla de referencia de MPCs oficiales por mes y país.
-- El valor viene del GSheet (dato fijo mantenido por el equipo).
-- Se usa como denominador en: % Retención, Churn Bruto, Churn Neto.

CREATE TABLE public.mpc_referencia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes  TEXT NOT NULL,          -- formato YYYY-MM  (ej: "2026-05")
  pais TEXT NOT NULL DEFAULT 'Región',
  mpcs INTEGER NOT NULL,       -- activas oficiales al cierre del mes
  nota TEXT,                   -- ej: "importado del GSheet, hoja Retención J23"
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mes, pais)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mpc_referencia TO anon, authenticated;
GRANT ALL ON public.mpc_referencia TO service_role;

ALTER TABLE public.mpc_referencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.mpc_referencia FOR ALL USING (true) WITH CHECK (true);

-- Seed: valor conocido de Mayo 2026
INSERT INTO public.mpc_referencia (mes, pais, mpcs, nota)
VALUES ('2026-05', 'Región', 32338, 'GSheet Evolución Retención J23 - dato fijo');
