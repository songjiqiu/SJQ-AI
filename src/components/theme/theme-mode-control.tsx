"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const themeModes = ["light", "dark", "system"] as const;

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor
};

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export function ThemeModeControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );

  return (
    <div
      aria-label={t("aria")}
      className={cn(
        "flex h-10 items-center rounded-lg border border-border bg-surface-muted p-1",
        className
      )}
      role="group"
    >
      {themeModes.map((mode) => {
        const Icon = themeIcons[mode];
        const isActive = isHydrated && theme === mode;

        return (
          <button
            key={mode}
            type="button"
            aria-label={t(`${mode}.label`)}
            title={t(`${mode}.label`)}
            onClick={() => setTheme(mode)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted transition outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
              isActive && "bg-surface text-foreground shadow-sm"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export type { ThemeMode } from "@/components/theme/theme-provider";
