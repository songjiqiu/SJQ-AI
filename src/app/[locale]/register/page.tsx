import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { routing } from "@/i18n/routing";
import { getRoleLandingPath } from "@/lib/auth/role-landing";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RegisterPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const user = await getCurrentUser();

  if (user) {
    redirect(`/${locale}${getRoleLandingPath(user)}`);
  }

  return <AuthCard mode="register" />;
}
