"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { keepSettingsDialogOpenKey } from "@/lib/settings/dialog-state";
import { cn } from "@/lib/utils";

const localeLabelKeys: Record<AppLocale, "zh" | "en"> = {
  "zh-CN": "zh",
  "en-US": "en"
};

export function LocaleSwitcher() {
  const activeLocale = useLocale() as AppLocale;
  const t = useTranslations("locale");

  return (
    <nav
      aria-label={t("aria")}
      className="flex h-10 items-center rounded-lg border border-border bg-surface-muted p-1"
    >
      {routing.locales.map((locale) => {
        const isActive = locale === activeLocale;

        return (
          <Link
            key={locale}
            href="/"
            locale={locale}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-8 min-w-12 items-center justify-center rounded-md px-2 text-sm font-medium text-muted transition outline-none focus-visible:ring-2 focus-visible:ring-accent",
              isActive && "bg-surface text-foreground shadow-sm"
            )}
          >
            {t(localeLabelKeys[locale])}
          </Link>
        );
      })}
    </nav>
  );
}

export function LocaleSelect({
  className,
  keepSettingsDialogOpen
}: {
  className?: string;
  keepSettingsDialogOpen?: boolean;
}) {
  const activeLocale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("locale");

  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{t("aria")}</span>
      <select
        aria-label={t("aria")}
        className="h-11 w-full appearance-none rounded-lg border border-border bg-surface px-3 pr-9 text-sm font-medium text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        onChange={(event) => {
          if (keepSettingsDialogOpen) {
            window.sessionStorage.setItem(keepSettingsDialogOpenKey, "1");
          }

          router.replace(pathname, {
            locale: event.target.value as AppLocale
          });
        }}
        value={activeLocale}
      >
        {routing.locales.map((locale) => (
          <option key={locale} value={locale}>
            {t(localeLabelKeys[locale])}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </label>
  );
}
