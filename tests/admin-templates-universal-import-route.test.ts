import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  class UnauthorizedError extends Error {}

  return {
    UnauthorizedError,
    requireAdminUser: vi.fn()
  };
});

const templates = vi.hoisted(() => ({
  importUniversalPptTemplatesV1: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireAdminUser: auth.requireAdminUser
}));

vi.mock("@/lib/admin/templates/service", () => ({
  PptTemplateNotFoundError: class PptTemplateNotFoundError extends Error {},
  PptTemplatePackageImportError: class PptTemplatePackageImportError extends Error {},
  importUniversalPptTemplatesV1: templates.importUniversalPptTemplatesV1
}));

import { POST } from "@/app/api/admin/templates/universal-v1/import/route";

describe("POST /api/admin/templates/universal-v1/import", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new auth.UnauthorizedError());

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("UNAUTHORIZED");
  });

  it("imports universal templates for administrators", async () => {
    auth.requireAdminUser.mockResolvedValue({
      id: "admin-1"
    });
    templates.importUniversalPptTemplatesV1.mockResolvedValue({
      createdCount: 45,
      deletedCount: 17,
      templates: []
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(templates.importUniversalPptTemplatesV1).toHaveBeenCalledTimes(1);
    expect(payload).toEqual({
      createdCount: 45,
      deletedCount: 17,
      templates: []
    });
  });
});
