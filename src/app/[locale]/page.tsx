import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { routing } from "@/i18n/routing";
import { getRoleLandingPath } from "@/lib/auth/role-landing";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage({
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

  if (!user) {
    redirect(`/${locale}/login`);
  }

  redirect(`/${locale}${getRoleLandingPath(user)}`);
}
