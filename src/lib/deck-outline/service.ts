import { Prisma } from "@prisma/client";

import {
  analyzeDeckIntent,
  createDeckOutline,
  normalizeSlideContent,
  normalizeUnifiedVisualSpec,
  type AnalyzeDeckOptions
} from "@/lib/ai-deck/analyzer";
import {
  deckOutlineIntentInputSchema,
  deckStructureSlideSchema,
  generationInputSchema,
  type AnalyzeDeckRequest,
  type DeckOutlineIntentInput,
  type DeckIntentAnalysisResult
} from "@/lib/ai-deck/schema";
import { NotFoundError } from "@/lib/ai-config/service";
import { prisma } from "@/lib/db/prisma";
import { isMissingPrismaModelStorageError } from "@/lib/db/prisma-errors";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";

import {
  createDeckOutlineDraftSchema,
  deckOutlineDraftListItemSchema,
  deckOutlineDraftSchema,
  updateDeckOutlineDraftSchema,
  type CreateDeckOutlineDraftInput,
  type DeckOutlineDraft,
  type DeckOutlineDraftListItem
} from "./schema";

const supportedTextFileExtensions = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".docx"
]);
const outlineSourceTextMaxLength = 24000;

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
  generationInputSchema.parse(input);

  const intentAnalysis = buildConfirmedIntentAnalysis(input);
  const outlineInput = buildAnalyzeDeckRequest(input);
  const outline = await createDeckOutline(
    outlineInput,
    intentAnalysis.structureOutline,
    intentAnalysis.fileSummaries,
    {
      ...options.analyzerOptions,
      intentAnalysis
    }
  );
  const draft = await prisma.deckOutlineDraft.create({
    data: {
      userId,
      mode: outline.mode,
      title: outline.deckTitle,
      summary: outline.deckSummary,
      input: toInputJson(outlineInput),
      fileSummaries: toInputJson(intentAnalysis.fileSummaries),
      intentAnalysis: toInputJson(intentAnalysis),
      unifiedVisualSpec: toInputJson(outline.unifiedVisualSpec),
      slides: toInputJson(outline.slides)
    }
  });

  return serializeDeckOutlineDraft(draft);
}

export async function analyzeDeckOutlineIntentForUser(
  rawInput: unknown,
  options: CreateDeckOutlineDraftOptions = {}
) {
  const input = deckOutlineIntentInputSchema.parse(rawInput);

  validateTextFiles(input.textFiles);
  generationInputSchema.parse(input);

  return analyzeDeckIntent(input, options.analyzerOptions);
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

  const normalizedVisualSpec = normalizeUnifiedVisualSpec(
    input.unifiedVisualSpec,
    existing.input as AnalyzeDeckRequest
  );
  const draft = await prisma.deckOutlineDraft.update({
    where: {
      id: draftId
    },
    data: {
      title: input.deckTitle,
      summary: input.deckSummary,
      unifiedVisualSpec: toInputJson(normalizedVisualSpec),
      slides: toInputJson(input.slides)
    }
  });

  return serializeDeckOutlineDraft(draft);
}

export async function deleteDeckOutlineDraftForUser(
  userId: string,
  draftId: string
) {
  const existing = await prisma.deckOutlineDraft.findFirst({
    where: {
      id: draftId,
      userId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new NotFoundError("Outline draft not found");
  }

  const activeProject = await prisma.deckProject.findFirst({
    where: {
      sourceOutlineDraftId: draftId,
      status: "GENERATING",
      userId
    },
    select: {
      id: true
    }
  });

  if (activeProject) {
    throw new ActiveGenerationExistsError();
  }

  await prisma.deckOutlineDraft.delete({
    where: {
      id: draftId
    }
  });
}

function buildAnalyzeDeckRequest(
  input: CreateDeckOutlineDraftInput
): AnalyzeDeckRequest {
  return {
    sourceText: mergeSourceText(input),
    audience: input.confirmedPlan.audience,
    goal: input.confirmedPlan.goal,
    coreMessage: input.confirmedPlan.coreMessage,
    pageCount: input.confirmedPlan.recommendedPageCount,
    deckType: input.deckType,
    palette: input.palette,
    locale: input.locale,
    parsedFiles: input.parsedFiles ?? [],
    sources: input.sources ?? []
  };
}

function buildConfirmedIntentAnalysis(
  input: CreateDeckOutlineDraftInput
): DeckIntentAnalysisResult {
  return {
    ...input.confirmedPlan,
    fileSummaries: buildFileSummaries(input),
    input: {
      idea: input.idea,
      sourceText: input.sourceText,
      textFiles: input.textFiles,
      parsedFiles: input.parsedFiles ?? [],
      sources: input.sources ?? [],
      ...(input.pageCount ? { pageCount: input.pageCount } : {}),
      deckType: input.deckType,
      palette: input.palette,
      locale: input.locale
    }
  };
}

function buildFileSummaries(input: CreateDeckOutlineDraftInput) {
  if ((input.parsedFiles ?? []).length > 0) {
    return (input.parsedFiles ?? []).map((file) => ({
      characterCount: file.characterCount,
      name: file.name,
      size: file.size,
      summary: compactText(file.summary || file.text, 500),
      snippets: buildFileSnippets(file.text || file.summary)
    }));
  }

  return input.textFiles.map((file) => ({
    characterCount: file.content.length,
    name: file.name,
    size: file.size,
    summary: compactText(file.content, 500),
    snippets: buildFileSnippets(file.content)
  }));
}

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

function buildFileSnippets(content: string) {
  return content
    .split(/\n{2,}|(?<=[。！？.!?])\s+/)
    .map((item) => compactText(item, 1200))
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

function mergeSourceText(input: CreateDeckOutlineDraftInput) {
  const sections = [
    ["创作想法", input.idea],
    ["补充文本", input.sourceText],
    ...(input.sources ?? []).map(
      (source) => [`来源 ${source.sourceId}：${source.label}`, source.text] as const
    ),
    ...input.textFiles.map((file) => [`文件：${file.name}`, file.content] as const)
  ]
    .filter(([, content]) => content.trim().length > 0)
    .map(([title, content]) => `【${title}】\n${content.trim()}`);
  const merged = sections.join("\n\n").replace(/\s+\n/g, "\n").trim();

  return merged.length > outlineSourceTextMaxLength
    ? merged.slice(0, outlineSourceTextMaxLength)
    : merged;
}

function validateTextFiles(
  files:
    | CreateDeckOutlineDraftInput["textFiles"]
    | DeckOutlineIntentInput["textFiles"]
) {
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
  const input = draft.input as AnalyzeDeckRequest;
  const intentAnalysis = readIntentAnalysis(draft);
  const structureSlides =
    intentAnalysis &&
    typeof intentAnalysis === "object" &&
    "structureOutline" in intentAnalysis &&
    intentAnalysis.structureOutline &&
    typeof intentAnalysis.structureOutline === "object" &&
    "slides" in intentAnalysis.structureOutline &&
    Array.isArray(intentAnalysis.structureOutline.slides)
      ? intentAnalysis.structureOutline.slides.flatMap((slide) => {
          const parsed = deckStructureSlideSchema.safeParse(slide);

          return parsed.success ? [parsed.data] : [];
        })
      : [];
  const rawSlides = Array.isArray(draft.slides) ? draft.slides : [];

  return deckOutlineDraftSchema.parse({
    id: draft.id,
    mode: parseMode(draft.mode),
    deckTitle: draft.title,
    deckSummary: draft.summary,
    input: draft.input,
    fileSummaries: draft.fileSummaries,
    intentAnalysis,
    unifiedVisualSpec: normalizeUnifiedVisualSpec(draft.unifiedVisualSpec, input),
    slides: rawSlides.map((slide, index) =>
      normalizeSlideContent(slide, input, {
        expected: structureSlides[index],
        nextTitle: structureSlides[index + 1]?.title,
        previousTitle: structureSlides[index - 1]?.title,
        slideCount: rawSlides.length || input.pageCount
      })
    ),
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

function readIntentAnalysis(
  draft: Prisma.DeckOutlineDraftGetPayload<Record<string, never>>
) {
  return "intentAnalysis" in draft ? draft.intentAnalysis ?? undefined : undefined;
}
