import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "fudo.selectedPeriod";

type Ctx = {
  selectedPeriod: string;
  availablePeriods: string[];
  setSelectedPeriod: (p: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PeriodContext = createContext<Ctx | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [availablePeriods, setAvailable] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriodState] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function loadPeriods() {
    setLoading(true);
    try {
      // Una sola query con limit alto — solo traemos mes_exportacion (string ligero)
      // Filtramos a YYYY-MM (len=7) para excluir snapshots diarios (YYYY-MM-DD)
      const { data, error } = await supabase
        .from("clientes")
        .select("mes_exportacion")
        .not("mes_exportacion", "is", null)
        .limit(50000);
      if (error) throw error;
      const uniq = Array.from(
        new Set((data ?? []).map((r) => r.mes_exportacion as string).filter((p) => p?.length === 7)),
      ).sort((a, b) => b.localeCompare(a));

      setAvailable(uniq);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const next = stored && uniq.includes(stored) ? stored : uniq[0] ?? "";
      setSelectedPeriodState(next);
    } catch (e) {
      console.error("PeriodContext: error cargando períodos", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  const setSelectedPeriod = (p: string) => {
    setSelectedPeriodState(p);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, p);
  };

  return (
    <PeriodContext.Provider
      value={{ selectedPeriod, availablePeriods, setSelectedPeriod, loading, refresh: loadPeriods }}
    >
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod debe usarse dentro de PeriodProvider");
  return ctx;
}

export function periodLabel(p: string): string {
  if (!p) return "—";
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
