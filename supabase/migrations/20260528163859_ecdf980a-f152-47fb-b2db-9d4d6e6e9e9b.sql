DROP INDEX IF EXISTS public.clientes_cuenta_mes_key;
CREATE UNIQUE INDEX clientes_cuenta_mes_key
  ON public.clientes (id_cuenta_dash, mes_exportacion);