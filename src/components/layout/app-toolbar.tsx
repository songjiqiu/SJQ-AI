"use client";

import { Presentation, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "@/components/locale/locale-switcher";
import { ExperienceSettingsDialog } from "@/components/settings/experience-settings-dialog";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import type { CurrentUser } from "@/lib/auth/session";
import { keepSettingsDialogOpenKey } from "@/lib/settings/dialog-state";

type SessionPayload = {
  authenticated: boolean;
  user: CurrentUser | null;
};

export function AppToolbar() {
  const t = useTranslations("toolbar");
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (isAuthPage) {
      return;
    }

    if (window.sessionStorage.getItem(keepSettingsDialogOpenKey) === "1") {
      window.sessionStorage.removeItem(keepSettingsDialogOpenKey);
      const timeoutId = window.setTimeout(() => setSettingsOpen(true), 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [isAuthPage]);

  useEffect(() => {
    if (isAuthPage) {
      return;
    }

    let ignore = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session");

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as SessionPayload;

        if (!ignore) {
          setCurrentUser(payload.user);
        }
      } catch {
        if (!ignore) {
          setCurrentUser(null);
        }
      }
    }

    void loadSession();

    return () => {
      ignore = true;
    };
  }, [isAuthPage, pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/92 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-lg text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <Presentation className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">
              {t("appName")}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t("author")}
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {!isAuthPage ? (
            <>
              {currentUser ? <ToolbarAvatar user={currentUser} /> : null}
              {currentUser?.role === "ADMIN" ? (
                <Link
                  aria-label={t("adminHome")}
                  className="inline-flex size-10 items-center justify-center rounded-lg text-muted outline-none transition hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                  href="/admin"
                  title={t("adminHome")}
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
              <Button
                aria-label={t("settings")}
                onClick={() => setSettingsOpen(true)}
                size="icon"
                title={t("settings")}
                type="button"
                variant="ghost"
              >
                <Settings className="size-4" aria-hidden="true" />
              </Button>
            </>
          ) : null}
          {isAuthPage ? <LocaleSwitcher /> : null}
          {isAuthPage ? <ThemeModeControl /> : null}
        </div>
      </div>
      <ExperienceSettingsDialog
        onUserChange={setCurrentUser}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            window.sessionStorage.removeItem(keepSettingsDialogOpenKey);
          }

          setSettingsOpen(nextOpen);
        }}
        open={settingsOpen}
      />
    </header>
  );
}

function ToolbarAvatar({ user }: { user: CurrentUser }) {
  const t = useTranslations("toolbar");
  const label = getToolbarAvatarLabel(user);

  return (
    <span
      aria-label={t("avatar")}
      className="inline-flex size-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-accent-soft text-sm font-semibold text-accent-strong"
      title={label}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          src={user.avatarUrl}
        />
      ) : (
        getToolbarAvatarFallback(user)
      )}
    </span>
  );
}

function getToolbarAvatarLabel(user: CurrentUser) {
  return user.displayName?.trim() || user.email;
}

function getToolbarAvatarFallback(user: CurrentUser) {
  return getToolbarAvatarLabel(user).slice(0, 1).toUpperCase();
}
