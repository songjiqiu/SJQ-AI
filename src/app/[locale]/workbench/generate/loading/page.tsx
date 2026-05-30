import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { GenerateLoadingPage } from "@/components/workbench/generate-loading-page";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/session";

export default async function WorkbenchGenerateLoadingPage({
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

  return <GenerateLoadingPage />;
}
