"use client";

import { Toaster } from "sonner";

import { PaletteProvider } from "@/components/theme/palette-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PaletteProvider>{children}</PaletteProvider>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}
