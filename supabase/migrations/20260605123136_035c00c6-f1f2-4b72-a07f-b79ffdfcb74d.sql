CREATE TABLE public.mpc_referencia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes TEXT NOT NULL,
  pais TEXT NOT NULL DEFAULT 'Región',
  mpcs INTEGER NOT NULL,
  nota TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mes, pais)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mpc_referencia TO anon, authenticated;
GRANT ALL ON public.mpc_referencia TO service_role;

ALTER TABLE public.mpc_referencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON public.mpc_referencia FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.mpc_referencia (mes, pais, mpcs, nota)
VALUES ('2026-05', 'Región', 32338, 'GSheet Evolución Retención J23');