import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { CreationWorkbench } from "@/components/workbench/creation-workbench";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/session";

export default async function WorkbenchPage({
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

  return <CreationWorkbench showAdminBackLink={user.role === "ADMIN"} />;
}
