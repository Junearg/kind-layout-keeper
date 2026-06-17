CREATE TABLE public.clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_exportacion TEXT NOT NULL,
  id_cuenta_dash NUMERIC,
  id_hubspot TEXT,
  nombre TEXT,
  pais TEXT,
  ejecutivo TEXT,
  propietario_hubspot TEXT,
  etapa TEXT,
  gmv NUMERIC,
  plan TEXT,
  fecha_baja TIMESTAMPTZ,
  motivo_baja TEXT,
  submotivo_baja TEXT,
  estado_dash TEXT,
  motivo_metabase TEXT,
  comentarios_metabase TEXT,
  nps_periodo TEXT,
  nps_score NUMERIC,
  nps_categoria TEXT,
  nps_motivo TEXT,
  nps_submotivo TEXT,
  cant_contactos NUMERIC,
  meses_con_contacto TEXT,
  primera_fecha_contacto TIMESTAMPTZ,
  ultima_fecha_contacto TIMESTAMPTZ,
  temas_contacto TEXT,
  motivos_contacto TEXT,
  csat_onb_promedio NUMERIC,
  csat_onb_n NUMERIC,
  csat_cs_promedio NUMERIC,
  csat_cs_n NUMERIC,
  csat_periodo TEXT,
  mesas NUMERIC, salas NUMERIC, productos NUMERIC, cat_productos NUMERIC,
  pr_con_stock NUMERIC, pr_con_costo NUMERIC, ingredientes NUMERIC,
  cat_ingredientes NUMERIC, ing_con_stock NUMERIC, ing_con_costo NUMERIC,
  ing_en_recetas NUMERIC, sub_ing_en_recetas NUMERIC, usuarios NUMERIC,
  v_salon NUMERIC, v_delivery NUMERIC, v_mostrador NUMERIC, v_menu_online NUMERIC,
  v_pedidosya NUMERIC, v_ubereats NUMERIC, v_rappi NUMERIC, v_justo NUMERIC,
  v_ifood NUMERIC, v_didi NUMERIC, ad_pc NUMERIC, ad_tablet NUMERIC,
  ad_lista_precio NUMERIC, ad_combo NUMERIC, arqueos NUMERIC, propinas NUMERIC,
  movimientos_caja NUMERIC, gastos NUMERIC, fiscal NUMERIC,
  menu_online_habilitado NUMERIC, carta_qr_habilitado NUMERIC,
  zonas_delivery NUMERIC, descuentos NUMERIC, ventas_con_clientes NUMERIC,
  ventas_pagadas_mp NUMERIC, cantidad_proveedores NUMERIC, cantidad_clientes NUMERIC,
  cantidad_cajas NUMERIC, cantidad_turnos NUMERIC, ventas_deli_con_repartidor NUMERIC,
  cat_gastos_financiera NUMERIC, cat_gastos NUMERIC, sub_cat_gastos NUMERIC,
  UNIQUE(id_cuenta_dash, mes_exportacion)
);

CREATE INDEX idx_clientes_mes ON public.clientes(mes_exportacion);
CREATE INDEX idx_clientes_estado ON public.clientes(estado_dash);
CREATE INDEX idx_clientes_fecha_baja ON public.clientes(fecha_baja);
CREATE INDEX idx_clientes_pais ON public.clientes(pais);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO anon, authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.kpis_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  unidad TEXT,
  target_3m NUMERIC,
  target_6m NUMERIC,
  direccion TEXT DEFAULT 'bajar',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis_targets TO anon, authenticated;
GRANT ALL ON public.kpis_targets TO service_role;

ALTER TABLE public.kpis_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.kpis_targets FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.iniciativas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero INTEGER,
  area TEXT,
  titulo TEXT,
  descripcion TEXT,
  prioridad TEXT,
  estado TEXT DEFAULT 'planificado',
  timeline_semanas TEXT,
  impacto_esperado TEXT,
  mes_creacion TEXT,
  mes_actualizacion TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iniciativas TO anon, authenticated;
GRANT ALL ON public.iniciativas TO service_role;

ALTER TABLE public.iniciativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.iniciativas FOR ALL USING (true) WITH CHECK (true);