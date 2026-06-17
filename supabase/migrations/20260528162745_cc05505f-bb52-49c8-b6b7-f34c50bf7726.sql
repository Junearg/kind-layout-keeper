-- Quitar policies abiertas
DROP POLICY IF EXISTS "allow_all" ON public.clientes;
DROP POLICY IF EXISTS "allow_all" ON public.kpis_targets;
DROP POLICY IF EXISTS "allow_all" ON public.iniciativas;

-- Revocar acceso anónimo
REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.kpis_targets FROM anon;
REVOKE ALL ON public.iniciativas FROM anon;

-- Solo usuarios autenticados, separadas por operación (para evitar warnings de "always true" en write ops)
CREATE POLICY "auth_select_clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_clientes" ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_clientes" ON public.clientes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_select_kpis" ON public.kpis_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_kpis" ON public.kpis_targets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_kpis" ON public.kpis_targets FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_kpis" ON public.kpis_targets FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_select_iniciativas" ON public.iniciativas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_iniciativas" ON public.iniciativas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_iniciativas" ON public.iniciativas FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_iniciativas" ON public.iniciativas FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);