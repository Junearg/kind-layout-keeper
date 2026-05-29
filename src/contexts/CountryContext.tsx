import { createContext, useContext, useState, type ReactNode } from "react";

const STORAGE_KEY = "fudo.selectedCountry";

export const PAISES = ["Región", "Argentina", "Chile", "México", "Colombia", "Brasil", "Others"] as const;
export type Pais = (typeof PAISES)[number];

type Ctx = {
  selectedPais: Pais;
  setSelectedPais: (p: Pais) => void;
};

const CountryContext = createContext<Ctx | null>(null);

export function CountryProvider({ children }: { children: ReactNode }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const initial = (stored && PAISES.includes(stored as Pais) ? stored : "Región") as Pais;
  const [selectedPais, setSelectedPaisState] = useState<Pais>(initial);

  const setSelectedPais = (p: Pais) => {
    setSelectedPaisState(p);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, p);
  };

  return (
    <CountryContext.Provider value={{ selectedPais, setSelectedPais }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error("useCountry debe usarse dentro de CountryProvider");
  return ctx;
}

/** Convierte el nombre del contexto al valor exacto guardado en la BD (col "pais"). */
export function paisFilter(pais: Pais): string | null {
  if (pais === "Región") return null; // sin filtro = todos
  if (pais === "Others") return null; // se maneja con NOT IN lista conocida
  return pais;
}

export const PAISES_CONOCIDOS = ["Argentina", "Chile", "México", "Colombia", "Brasil"] as const;
