import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { OutlineReviewPage } from "@/components/workbench/outline-review-page";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/ai-config/service";
import { getDeckOutlineDraftForUser } from "@/lib/deck-outline/service";

export default async function WorkbenchOutlinePage({
  params
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  let draft;

  try {
    draft = await getDeckOutlineDraftForUser(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  return <OutlineReviewPage initialDraft={draft} />;
}
