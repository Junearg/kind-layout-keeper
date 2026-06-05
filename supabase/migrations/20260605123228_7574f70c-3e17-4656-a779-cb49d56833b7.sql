DROP POLICY IF EXISTS "allow_all" ON public.mpc_referencia;

CREATE POLICY "mpc_referencia_select_all" ON public.mpc_referencia FOR SELECT USING (true);
CREATE POLICY "mpc_referencia_insert_auth" ON public.mpc_referencia FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mpc_referencia_update_auth" ON public.mpc_referencia FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mpc_referencia_delete_auth" ON public.mpc_referencia FOR DELETE USING (auth.uid() IS NOT NULL);