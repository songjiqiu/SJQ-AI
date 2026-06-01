"use client";

import {
  ArrowLeft,
  LoaderCircle,
  Power,
  PowerOff,
  RefreshCcw,
  ShieldCheck,
  ShieldOff,
  Users
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AdminUserDto } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

type AdminUsersManagementProps = {
  currentUserId: string;
  initialUsers: AdminUserDto[];
};

type ErrorMessages = {
  accountDisabled: string;
  forbidden: string;
  generic: string;
  lastAdmin: string;
  notFound: string;
  selfBlocked: string;
  unauthorized: string;
  validation: string;
};

export function AdminUsersManagement({
  currentUserId,
  initialUsers
}: AdminUsersManagementProps) {
  const t = useTranslations("adminUsers");
  const locale = useLocale();
  const [users, setUsers] = useState(initialUsers);
  const [isLoading, setIsLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingDisableUser, setPendingDisableUser] =
    useState<AdminUserDto | null>(null);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale]
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short"
      }),
    [locale]
  );
  const errorMessages = useMemo(
    () => ({
      accountDisabled: t("errors.accountDisabled"),
      forbidden: t("errors.forbidden"),
      generic: t("errors.generic"),
      lastAdmin: t("errors.lastAdmin"),
      notFound: t("errors.notFound"),
      selfBlocked: t("errors.selfBlocked"),
      unauthorized: t("errors.unauthorized"),
      validation: t("errors.validation")
    }),
    [t]
  );

  const refreshUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/users");

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      setUsers(payload.users ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errors.generic");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [errorMessages, t]);

  async function updateUser(
    user: AdminUserDto,
    input: Partial<Pick<AdminUserDto, "isActive" | "role">>
  ) {
    setSavingUserId(user.id);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      const updatedUser = payload.user as AdminUserDto;

      setUsers((current) =>
        current.map((item) => (item.id === updatedUser.id ? updatedUser : item))
      );
      toast.success(t("toast.saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errors.generic");
      toast.error(message);
    } finally {
      if (pendingDisableUser?.id === user.id) {
        setPendingDisableUser(null);
      }
      setSavingUserId(null);
    }
  }

  function requestActiveStatusChange(user: AdminUserDto) {
    if (user.isActive) {
      setPendingDisableUser(user);
      return;
    }

    void updateUser(user, { isActive: true });
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Link
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("actions.back")}
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {t("title")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                {t("subtitle")}
              </p>
            </div>
          </div>
        </div>
        <Button
          disabled={isLoading}
          onClick={() => void refreshUsers()}
          type="button"
          variant="secondary"
        >
          {isLoading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="size-4" aria-hidden="true" />
          )}
          {t("actions.refresh")}
        </Button>
      </header>

      <section
        aria-label={t("listAria")}
        className="overflow-hidden rounded-lg border border-border bg-surface"
      >
        {isLoading && users.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-muted">
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            {t("loading")}
          </div>
        ) : users.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center bg-background p-6 text-center text-sm text-muted">
            {t("empty")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isSaving = savingUserId === user.id;
              const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";

              return (
                <article
                  className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  key={user.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-all text-base font-semibold text-foreground">
                        {user.email}
                      </h2>
                      <Badge tone={user.role === "ADMIN" ? "accent" : "muted"}>
                        {t(`roles.${user.role}`)}
                      </Badge>
                      <Badge tone={user.isActive ? "success" : "warning"}>
                        {user.isActive
                          ? t("status.active")
                          : t("status.disabled")}
                      </Badge>
                      {isSelf ? <Badge tone="muted">{t("status.self")}</Badge> : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
                      <InfoItem
                        label={t("fields.createdAt")}
                        value={dateFormatter.format(new Date(user.createdAt))}
                      />
                      <InfoItem
                        label={t("fields.sessions")}
                        value={numberFormatter.format(user.counts.sessions)}
                      />
                      <InfoItem
                        label={t("fields.providers")}
                        value={numberFormatter.format(user.counts.providers)}
                      />
                      <InfoItem
                        label={t("fields.models")}
                        value={numberFormatter.format(user.counts.models)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Button
                      disabled={isSelf || isSaving}
                      onClick={() => void updateUser(user, { role: nextRole })}
                      size="sm"
                      title={isSelf ? t("actions.selfDisabled") : undefined}
                      type="button"
                      variant="secondary"
                    >
                      {user.role === "ADMIN" ? (
                        <ShieldOff className="size-4" aria-hidden="true" />
                      ) : (
                        <ShieldCheck className="size-4" aria-hidden="true" />
                      )}
                      {user.role === "ADMIN"
                        ? t("actions.setUser")
                        : t("actions.setAdmin")}
                    </Button>
                    <Button
                      disabled={isSelf || isSaving}
                      onClick={() => requestActiveStatusChange(user)}
                      size="sm"
                      title={isSelf ? t("actions.selfDisabled") : undefined}
                      type="button"
                      variant={user.isActive ? "ghost" : "secondary"}
                    >
                      {isSaving ? (
                        <LoaderCircle
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : user.isActive ? (
                        <PowerOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Power className="size-4" aria-hidden="true" />
                      )}
                      {user.isActive
                        ? t("actions.disable")
                        : t("actions.enable")}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <AlertDialog
        actionLabel={t("actions.disable")}
        cancelLabel={t("actions.cancel")}
        description={t("confirm.disable")}
        loading={savingUserId === pendingDisableUser?.id}
        onAction={() => {
          if (pendingDisableUser) {
            void updateUser(pendingDisableUser, { isActive: false });
          }
        }}
        onOpenChange={(open) => {
          if (!open && savingUserId !== pendingDisableUser?.id) {
            setPendingDisableUser(null);
          }
        }}
        open={pendingDisableUser !== null}
        title={t("confirm.disableTitle")}
      />
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-xs text-muted">{label}</span>
      <span className="block truncate font-medium text-foreground">{value}</span>
    </span>
  );
}

function Badge({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "accent" | "muted" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium",
        tone === "accent" && "bg-accent-soft text-accent-strong",
        tone === "muted" && "bg-surface-muted text-muted",
        tone === "success" && "bg-accent-soft text-accent-strong",
        tone === "warning" && "bg-warning/10 text-foreground"
      )}
    >
      {children}
    </span>
  );
}

async function readApiError(response: Response, messages: ErrorMessages) {
  try {
    const payload = await response.json();
    const code = typeof payload.error === "string" ? payload.error : "";

    if (code === "UNAUTHORIZED") {
      return messages.unauthorized;
    }

    if (code === "FORBIDDEN") {
      return messages.forbidden;
    }

    if (code === "ACCOUNT_DISABLED") {
      return messages.accountDisabled;
    }

    if (code === "LAST_ADMIN_REQUIRED") {
      return messages.lastAdmin;
    }

    if (code === "SELF_ADMIN_CHANGE_BLOCKED") {
      return messages.selfBlocked;
    }

    if (code === "VALIDATION_FAILED") {
      return messages.validation;
    }

    if (code === "NOT_FOUND") {
      return messages.notFound;
    }

    return messages.generic;
  } catch {
    return messages.generic;
  }
}
