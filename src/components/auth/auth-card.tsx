"use client";

import { LogIn, Mail, Presentation, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getRoleLandingPath,
  type RoleLandingUser
} from "@/lib/auth/role-landing";

type AuthMode = "login" | "register";

type AuthCardProps = {
  mode: AuthMode;
};

type AuthResponsePayload = {
  error?: string;
  user?: RoleLandingUser;
};

export function AuthCard({ mode }: AuthCardProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          body: JSON.stringify({
            email,
            password
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        }
      );
      const payload = (await response.json()) as AuthResponsePayload;

      if (!response.ok) {
        const code = typeof payload.error === "string" ? payload.error : "";
        const message =
          code === "EMAIL_EXISTS"
            ? t("errors.emailExists")
            : code === "INVALID_CREDENTIALS"
              ? t("errors.invalidCredentials")
              : code === "ACCOUNT_DISABLED"
                ? t("errors.accountDisabled")
                : code === "VALIDATION_FAILED"
                  ? t("errors.validation")
                  : t("errors.generic");

        throw new Error(message);
      }

      toast.success(isRegister ? t("toast.registered") : t("toast.loggedIn"));
      router.push(
        payload.user ? getRoleLandingPath(payload.user) : "/workbench"
      );
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("errors.generic");

      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-white">
            <Presentation className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isRegister ? t("register.title") : t("login.title")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {isRegister ? t("register.subtitle") : t("login.subtitle")}
            </p>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              {t("fields.email")}
            </span>
            <span className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                autoComplete="email"
                className="h-11 w-full rounded-lg border border-border bg-background px-9 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("fields.emailPlaceholder")}
                required
                type="email"
                value={email}
              />
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              {t("fields.password")}
            </span>
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("fields.passwordPlaceholder")}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
              {error}
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isRegister ? (
              <UserPlus className="size-4" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            )}
            {isSubmitting
              ? t("actions.submitting")
              : isRegister
                ? t("actions.register")
                : t("actions.login")}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted">
          {isRegister ? t("switch.toLoginText") : t("switch.toRegisterText")}{" "}
          <Link
            className="font-medium text-accent-strong outline-none focus-visible:ring-2 focus-visible:ring-accent"
            href={isRegister ? "/login" : "/register"}
          >
            {isRegister ? t("switch.toLogin") : t("switch.toRegister")}
          </Link>
        </div>
      </section>
    </main>
  );
}
