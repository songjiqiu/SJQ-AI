import { TemplateElementAssetKind } from "@prisma/client";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { AdminTemplateElementAssetsManagement } from "@/components/admin/admin-template-element-assets-management";
import { routing } from "@/i18n/routing";
import { listTemplateElementAssets } from "@/lib/admin/template-assets/service";
import { AccountDisabledError, ForbiddenError } from "@/lib/auth/access";
import { requireAdminUser, UnauthorizedError } from "@/lib/auth/session";

export default async function AdminTemplateContainersPage({
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

  return (
    <AdminTemplateElementAssetsManagement
      initialAssets={await listTemplateElementAssets({
        kind: TemplateElementAssetKind.CONTAINER
      })}
      kind={TemplateElementAssetKind.CONTAINER}
    />
  );
}
