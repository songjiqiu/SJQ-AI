import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  deckProject: {
    findFirst: vi.fn()
  },
  deckOutlineDraft: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma
}));

import {
  DeckOutlineFileValidationError,
  analyzeDeckOutlineIntentForUser,
  createDeckOutlineDraftForUser,
  deleteDeckOutlineDraftForUser,
  getDeckOutlineDraftForUser,
  listDeckOutlineDrafts,
  updateDeckOutlineDraftForUser
} from "@/lib/deck-outline/service";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";
import { normalizeUnifiedVisualSpec } from "@/lib/ai-deck/analyzer";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import type { JsonChatClient } from "@/lib/ai-deck/openai-json";
import {
  slideContentBlockMaxCount,
  type AnalyzeDeckRequest,
  type SlideContent
} from "@/lib/ai-deck/schema";

const input = {
  idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
  sourceText: "补充材料：团队已完成三个试点项目。",
  textFiles: [
    {
      name: "notes.md",
      size: 128,
      type: "text/markdown",
      content: "试点数据：转化率提升 20%。"
    }
  ],
  deckType: "business-report",
  palette: "star-map",
  locale: "zh-CN",
  confirmedPlan: {
    input: {
      idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
      sourceText: "补充材料：团队已完成三个试点项目。",
      textFiles: [
        {
          name: "notes.md",
          size: 128,
          type: "text/markdown",
          content: "试点数据：转化率提升 20%。"
        }
      ],
      deckType: "business-report",
      palette: "star-map",
      locale: "zh-CN"
    },
    fileSummaries: [
      {
        characterCount: 15,
        name: "notes.md",
        size: 128,
        summary: "试点数据：转化率提升 20%。",
        snippets: ["试点数据：转化率提升 20%。"]
      }
    ],
    deckType: "business-report",
    audience: "投资人",
    goal: "获得试点合作意向",
    coreMessage: "用市场机会与试点成果证明合作价值。",
    recommendedPageCount: 6,
    structureOutline: {
      deckTitle: "新能源融资路演",
      deckSummary: "这是一份用于确认结构的大纲草稿。",
      slides: Array.from({ length: 6 }, (_, index) => index + 1).map((index) => ({
        slideId: `slide-${index}`,
        index,
        title: `第 ${index} 页`,
        purpose: `说明第 ${index} 页的表达目的。`,
        keyMessage: `第 ${index} 页核心观点。`,
        visualDirection: "使用清晰主视觉配合文字信息。"
      }))
    }
  }
} as const;

function createFakeClient(queue: Array<unknown | Error>) {
  const calls: Array<Record<string, unknown>> = [];
  const create = vi.fn(async (payload: Record<string, unknown>) => {
    calls.push(payload);
    const next = queue.shift();

    if (next instanceof Error) {
      throw next;
    }

    return {
      choices: [
        {
          message: {
            content: typeof next === "string" ? next : JSON.stringify(next)
          }
        }
      ]
    };
  });

  return {
    calls,
    client: {
      chat: {
        completions: {
          create
        }
      }
    } satisfies JsonChatClient
  };
}

function toDetailedSlideOutline(slide: SlideContent) {
  return {
    adaptationRules: slide.adaptationRules,
    audienceFocus: slide.audienceFocus,
    contentBoundary: slide.contentBoundary,
    coreStatement: slide.coreStatement,
    explanationDepth: slide.explanationDepth,
    index: slide.index,
    narrativeRole: slide.narrativeRole,
    pageType: slide.pageType ?? "content",
    slideId: slide.slideId,
    slideTransition: slide.slideTransition,
    sourceRequirement: slide.sourceRequirement,
    speakerGoal: slide.speakerGoal,
    title: slide.title,
    viewerObjective: slide.viewerObjective,
    visualIntent: slide.visualIntent
  };
}

function buildAiOutlineResponses() {
  const outlineInput: AnalyzeDeckRequest = {
    sourceText: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
    audience: input.confirmedPlan.audience,
    goal: input.confirmedPlan.goal,
    coreMessage: input.confirmedPlan.coreMessage,
    pageCount: input.confirmedPlan.recommendedPageCount,
    deckType: input.deckType,
    palette: input.palette,
    locale: input.locale
  };
  const mock = buildMockAnalyzedDeck(outlineInput);
  const unifiedVisualSpec = normalizeUnifiedVisualSpec(
    mock.unifiedVisualSpec,
    outlineInput
  );
  const detailedOutline = {
    deckType: input.deckType,
    unifiedVisualSpec,
    slides: input.confirmedPlan.structureOutline.slides.map((structure, index) => ({
      ...toDetailedSlideOutline(mock.slides[index].content),
      slideId: structure.slideId,
      index: structure.index,
      title: structure.title,
      speakerGoal: structure.purpose,
      visualIntent: structure.visualDirection,
      coreStatement: structure.keyMessage
    }))
  };
  const displayContent = {
    deckType: input.deckType,
    unifiedVisualSpec,
    detailedOutline: detailedOutline.slides,
    slides: detailedOutline.slides.map((slide, index) => ({
      slideId: slide.slideId,
      index: slide.index,
      title: slide.title,
      bodyPoints: [slide.coreStatement, `第 ${index + 1} 页支撑信息`],
      contentBlocks: [
        {
          blockType: "title",
          priority: 1,
          text: slide.title
        },
        {
          blockType: "conclusion",
          priority: 1,
          text: slide.coreStatement
        },
        {
          blockType: "body",
          priority: 2,
          text: `第 ${index + 1} 页支撑信息`
        }
      ],
      contentLayers: {
        primary: [0, 1],
        supporting: [2],
        supplementary: []
      }
    }))
  };

  return {
    detailedOutline,
    displayContent,
    unifiedVisualSpec
  };
}

describe("deck outline service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.deckOutlineDraft.create.mockImplementation(async ({ data }) => ({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      id: "draft-1",
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      ...data
    }));
    prisma.deckProject.findFirst.mockReset();
    prisma.deckOutlineDraft.delete.mockReset();
    prisma.deckOutlineDraft.findFirst.mockReset();
    prisma.deckOutlineDraft.findMany.mockReset();
    prisma.deckOutlineDraft.update.mockReset();
  });

  it("creates an outline draft using local fallback and stores merged input", async () => {
    const draft = await createDeckOutlineDraftForUser("user-1", input, {
      analyzerOptions: {
        env: {
          OPENAI_API_KEY: ""
        }
      }
    });

    expect(draft.mode).toBe("mock");
    expect(draft.slides).toHaveLength(input.confirmedPlan.recommendedPageCount);
    expect(draft.slides[0]).toMatchObject({
      pageType: expect.any(String),
      contentBlocks: expect.arrayContaining([
        expect.objectContaining({
          blockType: expect.any(String),
          priority: expect.any(Number),
          text: expect.any(String)
        })
      ])
    });
    expect(draft.fileSummaries[0]).toMatchObject({
      name: "notes.md",
      size: 128
    });
    expect(prisma.deckOutlineDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          input: expect.objectContaining({
            coreMessage: "用市场机会与试点成果证明合作价值。",
            deckType: "business-report",
            pageCount: 6,
            sourceText: expect.stringContaining("文件：notes.md")
          }),
          intentAnalysis: expect.objectContaining({
            coreMessage: "用市场机会与试点成果证明合作价值。",
            recommendedPageCount: 6,
            structureOutline: expect.objectContaining({
              deckTitle: "新能源融资路演"
            })
          })
        })
      })
    );
  });

  it("ignores locked visual spec echoed by later stages and saves the draft", async () => {
    const { detailedOutline, displayContent, unifiedVisualSpec } =
      buildAiOutlineResponses();
    const fake = createFakeClient([
      unifiedVisualSpec,
      detailedOutline,
      {
        ...displayContent,
        unifiedVisualSpec: {
          ...unifiedVisualSpec,
          themeName: "模型改写后的视觉主题"
        }
      }
    ]);

    const draft = await createDeckOutlineDraftForUser("user-1", input, {
      analyzerOptions: {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    });

    expect(fake.calls).toHaveLength(3);
    expect(draft.unifiedVisualSpec.themeName).toBe(unifiedVisualSpec.themeName);
    expect(draft.unifiedVisualSpec.themeName).not.toBe("模型改写后的视觉主题");
    expect(prisma.deckOutlineDraft.create).toHaveBeenCalled();
  });

  it("limits display content blocks after response_format fallback", async () => {
    const { detailedOutline, displayContent, unifiedVisualSpec } =
      buildAiOutlineResponses();
    const overflowBlocks = [
      {
        blockType: "title",
        priority: 1,
        text: displayContent.slides[2].title
      },
      {
        blockType: "conclusion",
        priority: 1,
        text: "支撑内容零"
      },
      {
        blockType: "body",
        priority: 2,
        text: detailedOutline.slides[2].coreStatement
      },
      { blockType: "metric", priority: 2, text: "指标一" },
      { blockType: "metric", priority: 2, text: "指标二" },
      { blockType: "metric", priority: 2, text: "指标三" },
      { blockType: "body", priority: 3, text: "支撑内容一" },
      { blockType: "body", priority: 3, text: "支撑内容二" },
      { blockType: "body", priority: 3, text: "支撑内容三" },
      { blockType: "body", priority: 3, text: "支撑内容四" },
      { blockType: "note", priority: 5, text: "重复信息" },
      { blockType: "chart", priority: 4, text: "图表说明" },
      { blockType: "note", priority: 5, text: "低优先级溢出项" },
      { blockType: "conclusion", priority: 1, text: "关键保留项" },
      { blockType: "body", priority: 2, text: "重复信息" }
    ];
    const fake = createFakeClient([
      unifiedVisualSpec,
      detailedOutline,
      new Error("400 This response_format type is unavailable now"),
      {
        ...displayContent,
        slides: displayContent.slides.map((slide, index) =>
          index === 2
            ? {
                ...slide,
                contentBlocks: overflowBlocks,
                contentLayers: {
                  primary: [0, 1],
                  supporting: [2, 3, 4, 5, 6, 7],
                  supplementary: [8, 9, 10, 11]
                }
              }
            : slide
        )
      }
    ]);

    const draft = await createDeckOutlineDraftForUser("user-1", input, {
      analyzerOptions: {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "deepseek-v4-flash"
        }
      }
    });
    const targetTexts = draft.slides[2].contentBlocks.map((block) => block.text);

    expect(fake.calls).toHaveLength(4);
    expect(fake.calls[2]?.response_format).toMatchObject({
      type: "json_schema"
    });
    expect(fake.calls[3]?.response_format).toBeUndefined();
    expect(draft.slides[2].contentBlocks).toHaveLength(slideContentBlockMaxCount);
    expect(targetTexts).toContain("关键保留项");
    expect(targetTexts).not.toContain("低优先级溢出项");
    expect(targetTexts.filter((text) => text === "重复信息")).toHaveLength(1);
  });

  it("analyzes initial outline input without confirmed intent", async () => {
    await expect(
      analyzeDeckOutlineIntentForUser(
        {
          idea: input.idea,
          sourceText: input.sourceText,
          textFiles: input.textFiles,
          deckType: input.deckType,
          palette: input.palette,
          locale: input.locale
        },
        {
          analyzerOptions: {
            env: {
              OPENAI_API_KEY: ""
            }
          }
        }
      )
    ).resolves.toMatchObject({
      deckType: input.deckType,
      structureOutline: expect.objectContaining({
        slides: expect.any(Array)
      }),
      input: expect.objectContaining({
        idea: input.idea
      })
    });
  });

  it("accepts docx files and rejects unsupported file extensions", async () => {
    await expect(
      createDeckOutlineDraftForUser(
        "user-1",
        {
          ...input,
          textFiles: [
            {
              name: "brief.docx",
              size: 1024,
              content: "文档正文：补充路演背景。"
            }
          ]
        },
        {
          analyzerOptions: {
            env: {
              OPENAI_API_KEY: ""
            }
          }
        }
      )
    ).resolves.toMatchObject({
      fileSummaries: [
        expect.objectContaining({
          name: "brief.docx"
        })
      ]
    });

    await expect(
      createDeckOutlineDraftForUser(
        "user-1",
        {
          ...input,
          textFiles: [
            {
              name: "deck.pdf",
              size: 128,
              content: "not supported"
            }
          ]
        },
        {
          analyzerOptions: {
            env: {
              OPENAI_API_KEY: ""
            }
          }
        }
      )
    ).rejects.toBeInstanceOf(DeckOutlineFileValidationError);
  });

  it("lists valid outline drafts when slides are returned as JSON strings", async () => {
    prisma.deckOutlineDraft.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
        id: "draft-valid",
        mode: "mock",
        slides: JSON.stringify([{}, {}, {}, {}, {}, {}]),
        summary: "这是一份用于测试列表的大纲摘要。",
        title: "可读取大纲",
        updatedAt: new Date("2026-05-30T00:00:00.000Z")
      }
    ]);

    await expect(listDeckOutlineDrafts("user-1")).resolves.toEqual([
      {
        createdAt: "2026-05-30T00:00:00.000Z",
        deckSummary: "这是一份用于测试列表的大纲摘要。",
        deckTitle: "可读取大纲",
        id: "draft-valid",
        mode: "mock",
        slideCount: 6,
        updatedAt: "2026-05-30T00:00:00.000Z"
      }
    ]);
  });

  it("normalizes legacy outline drafts with missing structured fields", async () => {
    prisma.deckOutlineDraft.findFirst.mockResolvedValue({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      fileSummaries: [],
      id: "draft-legacy",
      input: {
        sourceText: "旧大纲输入文本用于兼容测试。",
        audience: "管理层",
        goal: "说明项目价值",
        coreMessage: "项目值得继续投入。",
        pageCount: 6,
        deckType: "business-report",
        style: "strategic",
        palette: "star-map",
        locale: "zh-CN"
      },
      intentAnalysis: input.confirmedPlan,
      mode: "ai-json",
      slides: Array.from({ length: 6 }, (_, index) => index + 1).map((index) => ({
        slideId: `slide-${index}`,
        index,
        title: `旧页面 ${index}`,
        bodyPoints: [`旧要点 ${index}`, "补充信息"],
        speakerGoal: "说明旧页面目标。",
        visualIntent: "使用旧视觉意图。"
      })),
      summary: "这是一份旧版大纲摘要。",
      title: "旧版大纲",
      unifiedVisualSpec: {
        colorRoleDefinitions: {
          accent: "#246BFE 用于关键指标。",
          background: "#D9E7FF 用于页面背景。",
          bodyText: "#17202A 用于正文。",
          chart: "#246BFE 与 #16A085 用于图表主次序列。",
          decorative: "#16A085 用于线条。",
          highlight: "#246BFE 用于关键词。",
          surface: "#D9E7FF 的浅层变化用于卡片。",
          titleText: "#17202A 用于标题。"
        },
        typographyScale: {
          annotation: {
            fontSize: 9,
            fontWeight: "regular",
            lineHeight: 1.22,
            usage: "来源、脚注和单位说明。"
          },
          body: {
            fontSize: 15,
            fontWeight: "regular",
            lineHeight: 1.28,
            usage: "正文要点和说明文字。"
          },
          chartLabel: {
            fontSize: 10,
            fontWeight: "medium",
            lineHeight: 1.18,
            usage: "图表坐标、标签和图例。"
          },
          coverTitle: {
            fontSize: 36,
            fontWeight: "bold",
            lineHeight: 1.12,
            usage: "封面主标题，最多两行。"
          },
          pageTitle: {
            fontSize: 26,
            fontWeight: "semibold",
            lineHeight: 1.16,
            usage: "页面标题和章节标题。"
          }
        }
      },
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      userId: "user-1"
    });

    const draft = await getDeckOutlineDraftForUser("user-1", "draft-legacy");

    expect(draft.slides[0]).toMatchObject({
      coreStatement: expect.any(String),
      narrativeRole: "setup",
      contentLayers: expect.objectContaining({
        primary: expect.any(Array)
      })
    });
    expect(draft.unifiedVisualSpec.typographyRules.scale.coverTitle.fontSize).toBe(36);
    expect(draft.unifiedVisualSpec.colorRoles.chart).toContain("#3B82F6");
    expect(draft.unifiedVisualSpec).not.toHaveProperty("typographyScale");
    expect(draft.unifiedVisualSpec).not.toHaveProperty("colorRoleDefinitions");
    expect(draft.unifiedVisualSpec.forbiddenVisualRules.join(" ")).toContain(
      "高饱和"
    );
    expect(draft.input).not.toHaveProperty("style");
    expect(draft.intentAnalysis?.input).not.toHaveProperty("style");
    expect(draft.intentAnalysis).not.toHaveProperty("style");
  });

  it("normalizes unified visual spec before saving outline draft updates", async () => {
    const existingDraft = await createDeckOutlineDraftForUser("user-1", input, {
      analyzerOptions: {
        env: {
          OPENAI_API_KEY: ""
        }
      }
    });
    const duplicateVisualSpec = {
      ...existingDraft.unifiedVisualSpec,
      consistencyRules: [
        "所有页面沿用同一色板",
        "所有页面沿用同一色板。",
        "标题和正文层级保持一致"
      ],
      forbiddenRules: [
        "禁止使用高饱和颜色",
        "禁止使用高饱和颜色。",
        "避免过度阴影和3D效果"
      ],
      forbiddenVisualRules: [
        "禁止使用高饱和颜色",
        "禁止使用高饱和颜色。",
        "避免过度阴影和3D效果",
        "禁止复杂背景"
      ],
      imageRules: {
        ...existingDraft.unifiedVisualSpec.imageRules,
        forbiddenItems: ["不要水印", "不要水印。", "不要复杂背景"],
        usageNotes: ["背景图低对比", "背景图低对比。", "主体避开标题区"]
      },
      pptTypeVisualTone: {
        ...existingDraft.unifiedVisualSpec.pptTypeVisualTone,
        visualKeywords: ["数据图表", "数据图表。", "结论先行"]
      }
    };

    prisma.deckOutlineDraft.findFirst.mockResolvedValue({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      fileSummaries: [],
      id: existingDraft.id,
      input: existingDraft.input,
      intentAnalysis: existingDraft.intentAnalysis,
      mode: existingDraft.mode,
      slides: existingDraft.slides,
      summary: existingDraft.deckSummary,
      title: existingDraft.deckTitle,
      unifiedVisualSpec: existingDraft.unifiedVisualSpec,
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      userId: "user-1"
    });
    prisma.deckOutlineDraft.update.mockImplementation(async ({ data }) => ({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      fileSummaries: [],
      id: existingDraft.id,
      input: existingDraft.input,
      intentAnalysis: existingDraft.intentAnalysis,
      mode: existingDraft.mode,
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      userId: "user-1",
      ...data
    }));

    const updated = await updateDeckOutlineDraftForUser("user-1", "draft-1", {
      deckTitle: existingDraft.deckTitle,
      deckSummary: existingDraft.deckSummary,
      slides: existingDraft.slides,
      unifiedVisualSpec: duplicateVisualSpec
    });
    const updateCall = prisma.deckOutlineDraft.update.mock.calls[0]?.[0];
    const savedVisualSpec = updateCall?.data.unifiedVisualSpec;

    expect(savedVisualSpec).toBeDefined();
    expect(
      savedVisualSpec.consistencyRules.filter((item: string) =>
        item.startsWith("所有页面沿用同一色板")
      )
    ).toHaveLength(1);
    expect(
      savedVisualSpec.forbiddenVisualRules.filter((item: string) =>
        item.startsWith("禁止使用高饱和颜色")
      )
    ).toHaveLength(1);
    expect(
      savedVisualSpec.imageRules.usageNotes.filter((item: string) =>
        item.startsWith("背景图低对比")
      )
    ).toHaveLength(1);
    expect(
      updated.unifiedVisualSpec.pptTypeVisualTone.visualKeywords.filter((item) =>
        item.startsWith("数据图表")
      )
    ).toHaveLength(1);
  });

  it("skips invalid historical outline drafts in the sidebar list", async () => {
    prisma.deckOutlineDraft.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
        id: "draft-invalid",
        mode: "mock",
        slides: [],
        summary: "",
        title: "坏数据",
        updatedAt: new Date("2026-05-30T00:00:00.000Z")
      },
      {
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
        id: "draft-valid",
        mode: "mock",
        slides: [{}, {}, {}, {}, {}, {}],
        summary: "这是一份用于测试列表的大纲摘要。",
        title: "可读取大纲",
        updatedAt: new Date("2026-05-30T00:00:00.000Z")
      }
    ]);

    const drafts = await listDeckOutlineDrafts("user-1");

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id: "draft-valid",
      slideCount: 6
    });
  });

  it("deletes current-user outline drafts when no generation is active", async () => {
    prisma.deckOutlineDraft.findFirst.mockResolvedValue({
      id: "draft-1"
    });
    prisma.deckProject.findFirst.mockResolvedValue(null);
    prisma.deckOutlineDraft.delete.mockResolvedValue({});

    await expect(
      deleteDeckOutlineDraftForUser("user-1", "draft-1")
    ).resolves.toBeUndefined();

    expect(prisma.deckOutlineDraft.findFirst).toHaveBeenCalledWith({
      select: {
        id: true
      },
      where: {
        id: "draft-1",
        userId: "user-1"
      }
    });
    expect(prisma.deckProject.findFirst).toHaveBeenCalledWith({
      select: {
        id: true
      },
      where: {
        sourceOutlineDraftId: "draft-1",
        status: "GENERATING",
        userId: "user-1"
      }
    });
    expect(prisma.deckOutlineDraft.delete).toHaveBeenCalledWith({
      where: {
        id: "draft-1"
      }
    });
  });

  it("blocks deleting an outline draft referenced by an active generation", async () => {
    prisma.deckOutlineDraft.findFirst.mockResolvedValue({
      id: "draft-1"
    });
    prisma.deckProject.findFirst.mockResolvedValue({
      id: "deck-active"
    });

    await expect(
      deleteDeckOutlineDraftForUser("user-1", "draft-1")
    ).rejects.toBeInstanceOf(ActiveGenerationExistsError);

    expect(prisma.deckOutlineDraft.delete).not.toHaveBeenCalled();
  });
});
