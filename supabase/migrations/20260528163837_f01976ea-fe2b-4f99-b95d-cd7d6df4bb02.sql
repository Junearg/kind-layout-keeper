CREATE UNIQUE INDEX IF NOT EXISTS clientes_cuenta_mes_key
  ON public.clientes (id_cuenta_dash, mes_exportacion)
  WHERE id_cuenta_dash IS NOT NULL;