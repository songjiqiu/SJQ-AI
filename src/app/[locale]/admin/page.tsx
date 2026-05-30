import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { AdminHome } from "@/components/admin/admin-home";
import { routing } from "@/i18n/routing";
import { AccountDisabledError, ForbiddenError } from "@/lib/auth/access";
import { requireAdminUser, UnauthorizedError } from "@/lib/auth/session";

export default async function AdminPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  try {
    await requireAdminUser();
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof AccountDisabledError
    ) {
      redirect(`/${locale}/login`);
    }

    if (error instanceof ForbiddenError) {
      redirect(`/${locale}/workbench`);
    }

    throw error;
  }

  return <AdminHome />;
}
