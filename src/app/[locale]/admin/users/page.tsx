import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { AdminUsersManagement } from "@/components/admin/admin-users-management";
import { routing } from "@/i18n/routing";
import { listAdminUsers } from "@/lib/admin/users";
import { AccountDisabledError, ForbiddenError } from "@/lib/auth/access";
import { requireAdminUser, UnauthorizedError } from "@/lib/auth/session";

export default async function AdminUsersPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  let admin;

  try {
    admin = await requireAdminUser();
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

  return (
    <AdminUsersManagement
      currentUserId={admin.id}
      initialUsers={await listAdminUsers()}
    />
  );
}
