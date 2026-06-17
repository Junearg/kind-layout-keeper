export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          ad_combo: number | null
          ad_lista_precio: number | null
          ad_pc: number | null
          ad_tablet: number | null
          arqueos: number | null
          cant_contactos: number | null
          cantidad_cajas: number | null
          cantidad_clientes: number | null
          cantidad_proveedores: number | null
          cantidad_turnos: number | null
          carta_qr_habilitado: number | null
          cat_gastos: number | null
          cat_gastos_financiera: number | null
          cat_ingredientes: number | null
          cat_productos: number | null
          comentarios_metabase: string | null
          csat_cs_n: number | null
          csat_cs_promedio: number | null
          csat_onb_n: number | null
          csat_onb_promedio: number | null
          csat_periodo: string | null
          descuentos: number | null
          ejecutivo: string | null
          estado_dash: string | null
          etapa: string | null
          fecha_baja: string | null
          fiscal: number | null
          gastos: number | null
          gmv: number | null
          id: string
          id_cuenta_dash: number | null
          id_hubspot: string | null
          ing_con_costo: number | null
          ing_con_stock: number | null
          ing_en_recetas: number | null
          ingredientes: number | null
          menu_online_habilitado: number | null
          mes_exportacion: string
          mesas: number | null
          meses_con_contacto: string | null
          motivo_baja: string | null
          motivo_metabase: string | null
          motivos_contacto: string | null
          movimientos_caja: number | null
          nombre: string | null
          nps_categoria: string | null
          nps_motivo: string | null
          nps_periodo: string | null
          nps_score: number | null
          nps_submotivo: string | null
          pais: string | null
          plan: string | null
          pr_con_costo: number | null
          pr_con_stock: number | null
          primera_fecha_contacto: string | null
          productos: number | null
          propietario_hubspot: string | null
          propinas: number | null
          salas: number | null
          sub_cat_gastos: number | null
          sub_ing_en_recetas: number | null
          submotivo_baja: string | null
          temas_contacto: string | null
          ultima_fecha_contacto: string | null
          usuarios: number | null
          v_delivery: number | null
          v_didi: number | null
          v_ifood: number | null
          v_justo: number | null
          v_menu_online: number | null
          v_mostrador: number | null
          v_pedidosya: number | null
          v_rappi: number | null
          v_salon: number | null
          v_ubereats: number | null
          ventas_con_clientes: number | null
          ventas_deli_con_repartidor: number | null
          ventas_pagadas_mp: number | null
          zonas_delivery: number | null
        }
        Insert: {
          ad_combo?: number | null
          ad_lista_precio?: number | null
          ad_pc?: number | null
          ad_tablet?: number | null
          arqueos?: number | null
          cant_contactos?: number | null
          cantidad_cajas?: number | null
          cantidad_clientes?: number | null
          cantidad_proveedores?: number | null
          cantidad_turnos?: number | null
          carta_qr_habilitado?: number | null
          cat_gastos?: number | null
          cat_gastos_financiera?: number | null
          cat_ingredientes?: number | null
          cat_productos?: number | null
          comentarios_metabase?: string | null
          csat_cs_n?: number | null
          csat_cs_promedio?: number | null
          csat_onb_n?: number | null
          csat_onb_promedio?: number | null
          csat_periodo?: string | null
          descuentos?: number | null
          ejecutivo?: string | null
          estado_dash?: string | null
          etapa?: string | null
          fecha_baja?: string | null
          fiscal?: number | null
          gastos?: number | null
          gmv?: number | null
          id?: string
          id_cuenta_dash?: number | null
          id_hubspot?: string | null
          ing_con_costo?: number | null
          ing_con_stock?: number | null
          ing_en_recetas?: number | null
          ingredientes?: number | null
          menu_online_habilitado?: number | null
          mes_exportacion: string
          mesas?: number | null
          meses_con_contacto?: string | null
          motivo_baja?: string | null
          motivo_metabase?: string | null
          motivos_contacto?: string | null
          movimientos_caja?: number | null
          nombre?: string | null
          nps_categoria?: string | null
          nps_motivo?: string | null
          nps_periodo?: string | null
          nps_score?: number | null
          nps_submotivo?: string | null
          pais?: string | null
          plan?: string | null
          pr_con_costo?: number | null
          pr_con_stock?: number | null
          primera_fecha_contacto?: string | null
          productos?: number | null
          propietario_hubspot?: string | null
          propinas?: number | null
          salas?: number | null
          sub_cat_gastos?: number | null
          sub_ing_en_recetas?: number | null
          submotivo_baja?: string | null
          temas_contacto?: string | null
          ultima_fecha_contacto?: string | null
          usuarios?: number | null
          v_delivery?: number | null
          v_didi?: number | null
          v_ifood?: number | null
          v_justo?: number | null
          v_menu_online?: number | null
          v_mostrador?: number | null
          v_pedidosya?: number | null
          v_rappi?: number | null
          v_salon?: number | null
          v_ubereats?: number | null
          ventas_con_clientes?: number | null
          ventas_deli_con_repartidor?: number | null
          ventas_pagadas_mp?: number | null
          zonas_delivery?: number | null
        }
        Update: {
          ad_combo?: number | null
          ad_lista_precio?: number | null
          ad_pc?: number | null
          ad_tablet?: number | null
          arqueos?: number | null
          cant_contactos?: number | null
          cantidad_cajas?: number | null
          cantidad_clientes?: number | null
          cantidad_proveedores?: number | null
          cantidad_turnos?: number | null
          carta_qr_habilitado?: number | null
          cat_gastos?: number | null
          cat_gastos_financiera?: number | null
          cat_ingredientes?: number | null
          cat_productos?: number | null
          comentarios_metabase?: string | null
          csat_cs_n?: number | null
          csat_cs_promedio?: number | null
          csat_onb_n?: number | null
          csat_onb_promedio?: number | null
          csat_periodo?: string | null
          descuentos?: number | null
          ejecutivo?: string | null
          estado_dash?: string | null
          etapa?: string | null
          fecha_baja?: string | null
          fiscal?: number | null
          gastos?: number | null
          gmv?: number | null
          id?: string
          id_cuenta_dash?: number | null
          id_hubspot?: string | null
          ing_con_costo?: number | null
          ing_con_stock?: number | null
          ing_en_recetas?: number | null
          ingredientes?: number | null
          menu_online_habilitado?: number | null
          mes_exportacion?: string
          mesas?: number | null
          meses_con_contacto?: string | null
          motivo_baja?: string | null
          motivo_metabase?: string | null
          motivos_contacto?: string | null
          movimientos_caja?: number | null
          nombre?: string | null
          nps_categoria?: string | null
          nps_motivo?: string | null
          nps_periodo?: string | null
          nps_score?: number | null
          nps_submotivo?: string | null
          pais?: string | null
          plan?: string | null
          pr_con_costo?: number | null
          pr_con_stock?: number | null
          primera_fecha_contacto?: string | null
          productos?: number | null
          propietario_hubspot?: string | null
          propinas?: number | null
          salas?: number | null
          sub_cat_gastos?: number | null
          sub_ing_en_recetas?: number | null
          submotivo_baja?: string | null
          temas_contacto?: string | null
          ultima_fecha_contacto?: string | null
          usuarios?: number | null
          v_delivery?: number | null
          v_didi?: number | null
          v_ifood?: number | null
          v_justo?: number | null
          v_menu_online?: number | null
          v_mostrador?: number | null
          v_pedidosya?: number | null
          v_rappi?: number | null
          v_salon?: number | null
          v_ubereats?: number | null
          ventas_con_clientes?: number | null
          ventas_deli_con_repartidor?: number | null
          ventas_pagadas_mp?: number | null
          zonas_delivery?: number | null
        }
        Relationships: []
      }
      iniciativas: {
        Row: {
          area: string | null
          descripcion: string | null
          estado: string | null
          id: string
          impacto_esperado: string | null
          mes_actualizacion: string | null
          mes_creacion: string | null
          numero: number | null
          prioridad: string | null
          timeline_semanas: string | null
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          descripcion?: string | null
          estado?: string | null
          id?: string
          impacto_esperado?: string | null
          mes_actualizacion?: string | null
          mes_creacion?: string | null
          numero?: number | null
          prioridad?: string | null
          timeline_semanas?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          descripcion?: string | null
          estado?: string | null
          id?: string
          impacto_esperado?: string | null
          mes_actualizacion?: string | null
          mes_creacion?: string | null
          numero?: number | null
          prioridad?: string | null
          timeline_semanas?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kpis_targets: {
        Row: {
          direccion: string | null
          id: string
          nombre: string
          target_3m: number | null
          target_6m: number | null
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          direccion?: string | null
          id?: string
          nombre: string
          target_3m?: number | null
          target_6m?: number | null
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          direccion?: string | null
          id?: string
          nombre?: string
          target_3m?: number | null
          target_6m?: number | null
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
