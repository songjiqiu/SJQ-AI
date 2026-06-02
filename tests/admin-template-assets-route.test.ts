import {
  Prisma,
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  class UnauthorizedError extends Error {}

  return {
    UnauthorizedError,
    requireAdminUser: vi.fn()
  };
});

const assets = vi.hoisted(() => ({
  createTemplateElementAsset: vi.fn(),
  deleteTemplateElementAsset: vi.fn(),
  getTemplateElementAsset: vi.fn(),
  listTemplateElementAssets: vi.fn(),
  searchTemplateElementAssetsForAi: vi.fn(),
  updateTemplateElementAsset: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireAdminUser: auth.requireAdminUser
}));

vi.mock("@/lib/admin/template-assets/service", () => ({
  TemplateElementAssetNotFoundError:
    class TemplateElementAssetNotFoundError extends Error {},
  TemplateElementAssetValidationError:
    class TemplateElementAssetValidationError extends Error {},
  createTemplateElementAsset: assets.createTemplateElementAsset,
  deleteTemplateElementAsset: assets.deleteTemplateElementAsset,
  getTemplateElementAsset: assets.getTemplateElementAsset,
  listTemplateElementAssets: assets.listTemplateElementAssets,
  searchTemplateElementAssetsForAi: assets.searchTemplateElementAssetsForAi,
  updateTemplateElementAsset: assets.updateTemplateElementAsset
}));

import {
  DELETE,
  GET as GET_ONE,
  PATCH
} from "@/app/api/admin/template-assets/[id]/route";
import { POST as AI_SEARCH } from "@/app/api/admin/template-assets/ai-search/route";
import { GET, POST } from "@/app/api/admin/template-assets/route";
import { ForbiddenError } from "@/lib/auth/access";

const adminUser = {
  email: "admin@example.com",
  id: "admin-1",
  isActive: true,
  role: "ADMIN"
};

const asset = {
  aiModifyPermissions: {
    allowAutoLayout: false,
    allowMove: true,
    allowRecolor: true,
    allowResize: true,
    allowStretch: false,
    allowTextShrink: false
  },
  backgroundModes: ["light", "dark"],
  colorTags: ["blue"],
  createdAt: "2026-06-02T00:00:00.000Z",
  description: "线性图标",
  id: "asset-1",
  isEnabled: true,
  kind: TemplateElementAssetKind.ICON,
  keywords: ["idea"],
  name: "概念图标",
  pageTypes: ["title-body-points"],
  preview: {
    iconName: "idea"
  },
  primaryCategory: "status-feedback",
  resource: {},
  reviewStatus: TemplateAssetReviewStatus.APPROVED,
  semanticTags: ["idea"],
  secondaryCategory: "result-status",
  setKey: "common",
  setKind: TemplateAssetSetKind.COMMON,
  setName: "通用套装",
  sortOrder: 1,
  source: TemplateAssetSource.MANUAL,
  style: {
    strokeColor: "#2563eb"
  },
  styleTags: ["minimal"],
  synonyms: ["concept"],
  tags: ["图标"],
  updatedAt: "2026-06-02T00:00:00.000Z",
  usageScenarios: ["feature"],
  variantKey: "warning"
};

describe("admin template element asset routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated list requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new auth.UnauthorizedError());

    const response = await GET(
      new Request("http://localhost/api/admin/template-assets")
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("UNAUTHORIZED");
  });

  it("rejects non-admin list requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new ForbiddenError());

    const response = await GET(
      new Request("http://localhost/api/admin/template-assets")
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("FORBIDDEN");
  });

  it("lists assets for administrators", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    assets.listTemplateElementAssets.mockResolvedValue([asset]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/template-assets?kind=ICON&includeDisabled=false&includeUnapproved=false&query=idea&primaryCategory=status-feedback&secondaryCategory=result-status&variantKey=warning&setKind=COMMON&setKey=common&pageType=title-body-points&styleTag=minimal&backgroundMode=light&reviewStatus=APPROVED"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(assets.listTemplateElementAssets).toHaveBeenCalledWith({
      includeDisabled: false,
      includeUnapproved: false,
      backgroundMode: "light",
      kind: TemplateElementAssetKind.ICON,
      pageType: "title-body-points",
      primaryCategory: "status-feedback",
      query: "idea",
      reviewStatus: TemplateAssetReviewStatus.APPROVED,
      secondaryCategory: "result-status",
      setKey: "common",
      setKind: TemplateAssetSetKind.COMMON,
      styleTag: "minimal",
      variantKey: "warning"
    });
    expect(payload.assets).toHaveLength(1);
  });

  it("creates assets", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    assets.createTemplateElementAsset.mockResolvedValue(asset);

    const response = await POST(
      new Request("http://localhost/api/admin/template-assets", {
        body: JSON.stringify({
          kind: "ICON",
          name: "概念图标",
          preview: {
            iconName: "idea"
          },
          primaryCategory: "status-feedback",
          secondaryCategory: "result-status",
          semanticTags: ["idea"],
          style: {
            strokeColor: "#2563eb"
          },
          variantKey: "warning"
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(assets.createTemplateElementAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: TemplateElementAssetKind.ICON,
        name: "概念图标",
        primaryCategory: "status-feedback",
        secondaryCategory: "result-status",
        variantKey: "warning"
      })
    );
    expect(payload.asset.id).toBe("asset-1");
  });

  it("reads and updates a single asset", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    assets.getTemplateElementAsset.mockResolvedValue(asset);
    assets.updateTemplateElementAsset.mockResolvedValue({
      ...asset,
      isEnabled: false
    });

    const readResponse = await GET_ONE(
      new Request("http://localhost/api/admin/template-assets/asset-1"),
      {
        params: Promise.resolve({
          id: "asset-1"
        })
      }
    );
    const readPayload = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(readPayload.asset.id).toBe("asset-1");

    const patchResponse = await PATCH(
      new Request("http://localhost/api/admin/template-assets/asset-1", {
        body: JSON.stringify({
          isEnabled: false,
          primaryCategory: "time-progress",
          reviewStatus: "PENDING_REVIEW",
          secondaryCategory: "time-object",
          variantKey: "calendar"
        }),
        method: "PATCH"
      }),
      {
        params: Promise.resolve({
          id: "asset-1"
        })
      }
    );
    const patchPayload = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(assets.updateTemplateElementAsset).toHaveBeenCalledWith(
      "asset-1",
      {
        isEnabled: false,
        primaryCategory: "time-progress",
        reviewStatus: TemplateAssetReviewStatus.PENDING_REVIEW,
        secondaryCategory: "time-object",
        variantKey: "calendar"
      }
    );
    expect(patchPayload.asset.isEnabled).toBe(false);
  });

  it("deletes assets", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    assets.deleteTemplateElementAsset.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/admin/template-assets/asset-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "asset-1"
        })
      }
    );

    expect(response.status).toBe(204);
    expect(assets.deleteTemplateElementAsset).toHaveBeenCalledWith("asset-1");
  });

  it("returns validation and duplicate errors", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);

    const validationResponse = await POST(
      new Request("http://localhost/api/admin/template-assets", {
        body: JSON.stringify({
          kind: "BAD",
          name: "坏资产",
          preview: {},
          style: {}
        }),
        method: "POST"
      })
    );
    const validationPayload = await validationResponse.json();

    expect(validationResponse.status).toBe(400);
    expect(validationPayload.error).toBe("VALIDATION_FAILED");

    assets.createTemplateElementAsset.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        clientVersion: "7.8.0",
        code: "P2002"
      })
    );

    const duplicateResponse = await POST(
      new Request("http://localhost/api/admin/template-assets", {
        body: JSON.stringify({
          kind: "ICON",
          name: "概念图标",
          preview: {
            iconName: "idea"
          },
          semanticTags: ["idea"],
          style: {
            strokeColor: "#2563eb"
          }
        }),
        method: "POST"
      })
    );
    const duplicatePayload = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(409);
    expect(duplicatePayload.error).toBe("DUPLICATE_RECORD");
  });

  it("searches AI assets for administrators", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    assets.searchTemplateElementAssetsForAi.mockResolvedValue([
      {
        ...asset,
        matchScore: 42,
        usageSuggestion: "用于当前页面，匹配 idea。"
      }
    ]);

    const response = await AI_SEARCH(
      new Request("http://localhost/api/admin/template-assets/ai-search", {
        body: JSON.stringify({
          backgroundMode: "light",
          kind: "ICON",
          pageType: "title-body-points",
          semanticTags: ["idea"],
          setKey: "common",
          styleTags: ["minimal"]
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(assets.searchTemplateElementAssetsForAi).toHaveBeenCalledWith({
      backgroundMode: "light",
      kind: TemplateElementAssetKind.ICON,
      limit: 12,
      pageType: "title-body-points",
      semanticTags: ["idea"],
      setKey: "common",
      styleTags: ["minimal"]
    });
    expect(payload.assets[0].matchScore).toBe(42);
  });
});
