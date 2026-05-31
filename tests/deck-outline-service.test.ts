import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  deckProject: {
    findFirst: vi.fn()
  },
  deckOutlineDraft: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn()
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
  listDeckOutlineDrafts
} from "@/lib/deck-outline/service";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";

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
  style: "strategic",
  palette: "star-map",
  locale: "zh-CN",
  confirmedIntent: {
    deckType: "business-report",
    style: "strategic",
    audience: "投资人",
    goal: "获得试点合作意向",
    coreMessage: "用市场机会与试点成果证明合作价值。",
    recommendedPageCount: 3
  }
};

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
    expect(draft.slides).toHaveLength(3);
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
            pageCount: 3,
            sourceText: expect.stringContaining("文件：notes.md")
          }),
          intentAnalysis: expect.objectContaining({
            coreMessage: "用市场机会与试点成果证明合作价值。",
            recommendedPageCount: 3
          })
        })
      })
    );
  });

  it("analyzes initial outline input without confirmed intent", async () => {
    await expect(
      analyzeDeckOutlineIntentForUser(
        {
          idea: input.idea,
          sourceText: input.sourceText,
          textFiles: input.textFiles,
          deckType: input.deckType,
          style: input.style,
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
      style: input.style,
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
        slides: JSON.stringify([{}, {}, {}]),
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
        slideCount: 3,
        updatedAt: "2026-05-30T00:00:00.000Z"
      }
    ]);
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
        slides: [{}, {}, {}],
        summary: "这是一份用于测试列表的大纲摘要。",
        title: "可读取大纲",
        updatedAt: new Date("2026-05-30T00:00:00.000Z")
      }
    ]);

    const drafts = await listDeckOutlineDrafts("user-1");

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id: "draft-valid",
      slideCount: 3
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
