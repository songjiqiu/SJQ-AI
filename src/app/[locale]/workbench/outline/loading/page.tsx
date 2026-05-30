import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { OutlineLoadingPage } from "@/components/workbench/outline-loading-page";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/session";

export default async function WorkbenchOutlineLoadingPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  if (!(await getCurrentUser())) {
    redirect(`/${locale}/login`);
  }

  return <OutlineLoadingPage />;
}
