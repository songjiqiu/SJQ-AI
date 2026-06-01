import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { AdminTemplateDesigner } from "@/components/admin/admin-template-designer";
import { routing } from "@/i18n/routing";
import {
  getPptTemplate,
  PptTemplateNotFoundError
} from "@/lib/admin/templates/service";
import { AccountDisabledError, ForbiddenError } from "@/lib/auth/access";
import { requireAdminUser, UnauthorizedError } from "@/lib/auth/session";

export default async function AdminTemplateDetailPage({
  params
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  let template;

  try {
    await requireAdminUser();
    template = await getPptTemplate(id);
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

    if (error instanceof PptTemplateNotFoundError) {
      notFound();
    }

    throw error;
  }

  return <AdminTemplateDesigner initialTemplate={template} />;
}
