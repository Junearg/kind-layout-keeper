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
      // Generamos los últimos 36 meses y hacemos COUNT por mes (queries livianas)
      // Esto evita el límite de 1000 filas de PostgREST
      const today = new Date();
      const candidates: string[] = [];
      for (let i = 0; i < 36; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        candidates.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        );
      }
      const results = await Promise.all(
        candidates.map((m) =>
          supabase
            .from("clientes")
            .select("*", { count: "exact", head: true })
            .eq("mes_exportacion", m),
        ),
      );
      const uniq = candidates
        .filter((_, i) => (results[i].count ?? 0) > 0)
        .sort((a, b) => b.localeCompare(a));

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
