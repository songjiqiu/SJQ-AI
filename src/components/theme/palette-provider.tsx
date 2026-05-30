"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { paletteIds, type PaletteId } from "@/lib/create-deck/options";

const paletteStorageKey = "pptcm_palette";
const defaultPalette: PaletteId = "star-map";

type PaletteContextValue = {
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

function isPaletteId(value: string | null): value is PaletteId {
  return Boolean(value && paletteIds.includes(value as PaletteId));
}

function applyPalette(palette: PaletteId) {
  document.documentElement.dataset.palette = palette;
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteId>(defaultPalette);

  useEffect(() => {
    const savedPalette = window.localStorage.getItem(paletteStorageKey);
    const nextPalette = isPaletteId(savedPalette) ? savedPalette : defaultPalette;

    applyPalette(nextPalette);
    const timeoutId = window.setTimeout(() => setPaletteState(nextPalette), 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const setPalette = useCallback((nextPalette: PaletteId) => {
    setPaletteState(nextPalette);
    window.localStorage.setItem(paletteStorageKey, nextPalette);
    applyPalette(nextPalette);
  }, []);

  const value = useMemo(
    () => ({
      palette,
      setPalette
    }),
    [palette, setPalette]
  );

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  );
}

export function usePalettePreset() {
  const context = useContext(PaletteContext);

  if (!context) {
    throw new Error("usePalettePreset must be used inside PaletteProvider");
  }

  return context;
}

export const paletteSwatches: Record<PaletteId, string> = {
  "star-map": "bg-[#246bfe]",
  matrix: "bg-[#13966a]",
  "deep-space": "bg-[#7c3aed]",
  "morning-mist": "bg-[#c05621]"
};
