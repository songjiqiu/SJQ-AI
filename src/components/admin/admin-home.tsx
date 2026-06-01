"use client";

import {
  ArrowRight,
  LayoutTemplate,
  Presentation,
  ShieldCheck,
  Users
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function AdminHome() {
  const t = useTranslations("adminHome");
  const entries = [
    {
      body: t("entries.users.body"),
      href: "/admin/users",
      icon: Users,
      title: t("entries.users.title")
    },
    {
      body: t("entries.templates.body"),
      href: "/admin/templates",
      icon: LayoutTemplate,
      title: t("entries.templates.title")
    },
    {
      body: t("entries.workbench.body"),
      href: "/workbench",
      icon: Presentation,
      title: t("entries.workbench.title")
    }
  ];

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl px-4 py-8">
      <header className="mb-6 flex items-start gap-3 border-b border-border pb-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {t("subtitle")}
          </p>
        </div>
      </header>

      <section
        aria-label={t("entryAria")}
        className="grid gap-4 md:grid-cols-2"
      >
        {entries.map((entry) => {
          const Icon = entry.icon;

          return (
            <Link
              className="group grid min-h-44 gap-4 rounded-lg border border-border bg-surface p-5 text-foreground outline-none transition hover:border-accent hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent"
              href={entry.href}
              key={entry.href}
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="grid gap-2">
                <span className="text-lg font-semibold">{entry.title}</span>
                <span className="text-sm leading-6 text-muted">
                  {entry.body}
                </span>
              </span>
              <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-accent-strong">
                {t("open")}
                <ArrowRight
                  className="size-4 transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
