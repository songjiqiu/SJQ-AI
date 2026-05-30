import { Prisma } from "@prisma/client";

import {
  createDeckOutline,
  type AnalyzeDeckOptions
} from "@/lib/ai-deck/analyzer";
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";
import { NotFoundError } from "@/lib/ai-config/service";
import { deckInputFileExtensions } from "@/lib/create-deck/file-options";
import { prisma } from "@/lib/db/prisma";
import { isMissingPrismaModelStorageError } from "@/lib/db/prisma-errors";

import {
  createDeckOutlineDraftSchema,
  deckOutlineDraftListItemSchema,
  deckOutlineDraftSchema,
  updateDeckOutlineDraftSchema,
  type CreateDeckOutlineDraftInput,
  type DeckOutlineDraft,
  type DeckOutlineDraftListItem
} from "./schema";

const supportedTextFileExtensions = new Set<string>(deckInputFileExtensions);

export type CreateDeckOutlineDraftOptions = {
  analyzerOptions?: AnalyzeDeckOptions;
};

export class DeckOutlineFileValidationError extends Error {
  details: Array<{ message: string; name: string }>;

  constructor(details: Array<{ message: string; name: string }>) {
    super("Deck outline text files are invalid");
    this.name = "DeckOutlineFileValidationError";
    this.details = details;
  }
}

export async function createDeckOutlineDraftForUser(
  userId: string,
  rawInput: unknown,
  options: CreateDeckOutlineDraftOptions = {}
): Promise<DeckOutlineDraft> {
  const input = createDeckOutlineDraftSchema.parse(rawInput);

  validateTextFiles(input.textFiles);

  const outlineInput = buildAnalyzeDeckRequest(input);
  const outline = await createDeckOutline(outlineInput, options.analyzerOptions);
  const draft = await prisma.deckOutlineDraft.create({
    data: {
      userId,
      mode: outline.mode,
      title: outline.deckTitle,
      summary: outline.deckSummary,
      input: toInputJson(outlineInput),
      fileSummaries: toInputJson(
        input.textFiles.map((file) => ({
          characterCount: file.content.length,
          name: file.name,
          size: file.size
        }))
      ),
      unifiedVisualSpec: toInputJson(outline.unifiedVisualSpec),
      slides: toInputJson(outline.slides)
    }
  });

  return serializeDeckOutlineDraft(draft);
}

export async function listDeckOutlineDrafts(
  userId: string
): Promise<DeckOutlineDraftListItem[]> {
  let drafts: Prisma.DeckOutlineDraftGetPayload<Record<string, never>>[];

  try {
    drafts = await prisma.deckOutlineDraft.findMany({
      where: {
        userId
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 20
    });
  } catch (error) {
    if (isMissingPrismaModelStorageError(error, "DeckOutlineDraft")) {
      return [];
    }

    throw error;
  }

  return drafts.flatMap((draft) => {
    const parsed = deckOutlineDraftListItemSchema.safeParse({
      id: draft.id,
      deckTitle: draft.title,
      deckSummary: draft.summary,
      mode: parseMode(draft.mode),
      slideCount: countSlides(draft.slides),
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString()
    });

    return parsed.success ? [parsed.data] : [];
  });
}

function countSlides(value: unknown) {
  const slides = typeof value === "string" ? parseJson(value) : value;

  return Array.isArray(slides) ? slides.length : 0;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getDeckOutlineDraftForUser(
  userId: string,
  draftId: string
): Promise<DeckOutlineDraft> {
  const draft = await prisma.deckOutlineDraft.findFirst({
    where: {
      id: draftId,
      userId
    }
  });

  if (!draft) {
    throw new NotFoundError("Outline draft not found");
  }

  return serializeDeckOutlineDraft(draft);
}

export async function updateDeckOutlineDraftForUser(
  userId: string,
  draftId: string,
  rawInput: unknown
): Promise<DeckOutlineDraft> {
  const input = updateDeckOutlineDraftSchema.parse(rawInput);
  const existing = await prisma.deckOutlineDraft.findFirst({
    where: {
      id: draftId,
      userId
    }
  });

  if (!existing) {
    throw new NotFoundError("Outline draft not found");
  }

  const draft = await prisma.deckOutlineDraft.update({
    where: {
      id: draftId
    },
    data: {
      title: input.deckTitle,
      summary: input.deckSummary,
      unifiedVisualSpec: toInputJson(input.unifiedVisualSpec),
      slides: toInputJson(input.slides)
    }
  });

  return serializeDeckOutlineDraft(draft);
}

function buildAnalyzeDeckRequest(
  input: CreateDeckOutlineDraftInput
): AnalyzeDeckRequest {
  return {
    sourceText: mergeSourceText(input),
    audience: input.audience,
    goal: input.goal,
    pageCount: input.pageCount,
    deckType: input.deckType,
    style: input.style,
    palette: input.palette,
    locale: input.locale
  };
}

function mergeSourceText(input: CreateDeckOutlineDraftInput) {
  const sections = [
    ["创作想法", input.idea],
    ["补充文本", input.sourceText],
    ...input.textFiles.map((file) => [`文件：${file.name}`, file.content] as const)
  ]
    .filter(([, content]) => content.trim().length > 0)
    .map(([title, content]) => `【${title}】\n${content.trim()}`);
  const merged = sections.join("\n\n").replace(/\s+\n/g, "\n").trim();

  return merged.length > 12000 ? merged.slice(0, 12000) : merged;
}

function validateTextFiles(files: CreateDeckOutlineDraftInput["textFiles"]) {
  const details = files
    .filter((file) => !supportedTextFileExtensions.has(getExtension(file.name)))
    .map((file) => ({
      name: file.name,
      message: "Unsupported text file extension"
    }));

  if (details.length > 0) {
    throw new DeckOutlineFileValidationError(details);
  }
}

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");

  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function serializeDeckOutlineDraft(
  draft: Prisma.DeckOutlineDraftGetPayload<Record<string, never>>
): DeckOutlineDraft {
  return deckOutlineDraftSchema.parse({
    id: draft.id,
    mode: parseMode(draft.mode),
    deckTitle: draft.title,
    deckSummary: draft.summary,
    input: draft.input,
    fileSummaries: draft.fileSummaries,
    unifiedVisualSpec: draft.unifiedVisualSpec,
    slides: draft.slides,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString()
  });
}

function parseMode(mode: string): "ai-json" | "mock" {
  return mode === "ai-json" ? "ai-json" : "mock";
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
