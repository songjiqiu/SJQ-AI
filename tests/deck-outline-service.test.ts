import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  deckOutlineDraft: {
    create: vi.fn(),
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma
}));

import {
  DeckOutlineFileValidationError,
  createDeckOutlineDraftForUser,
  listDeckOutlineDrafts
} from "@/lib/deck-outline/service";

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
  audience: "投资人",
  goal: "获得试点合作意向",
  pageCount: 3,
  deckType: "business-report",
  style: "strategic",
  palette: "star-map",
  locale: "zh-CN"
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
            deckType: "business-report",
            sourceText: expect.stringContaining("文件：notes.md")
          })
        })
      })
    );
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
});
