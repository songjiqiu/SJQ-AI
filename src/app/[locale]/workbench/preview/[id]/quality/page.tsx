import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { DeckQualityPage } from "@/components/workbench/deck-quality-page";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/session";
import {
  DeckProjectNotFoundError,
  getDeckProjectForUser
} from "@/lib/decks/service";

export default async function WorkbenchPreviewQualityPage({
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

  let deck;

  try {
    deck = await getDeckProjectForUser(user.id, id);
  } catch (error) {
    if (error instanceof DeckProjectNotFoundError) {
      notFound();
    }

    throw error;
  }

  return <DeckQualityPage deck={deck} />;
}
