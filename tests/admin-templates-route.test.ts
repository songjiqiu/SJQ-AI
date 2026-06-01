import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  class UnauthorizedError extends Error {}

  return {
    UnauthorizedError,
    requireAdminUser: vi.fn()
  };
});

const templates = vi.hoisted(() => ({
  createPptTemplate: vi.fn(),
  deletePptTemplate: vi.fn(),
  getPptTemplate: vi.fn(),
  listPptTemplates: vi.fn(),
  updatePptTemplate: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireAdminUser: auth.requireAdminUser
}));

vi.mock("@/lib/admin/templates/service", () => ({
  PptTemplateNotFoundError: class PptTemplateNotFoundError extends Error {},
  createPptTemplate: templates.createPptTemplate,
  deletePptTemplate: templates.deletePptTemplate,
  getPptTemplate: templates.getPptTemplate,
  listPptTemplates: templates.listPptTemplates,
  updatePptTemplate: templates.updatePptTemplate
}));

import { DELETE, GET as GET_ONE, PATCH } from "@/app/api/admin/templates/[id]/route";
import { GET, POST } from "@/app/api/admin/templates/route";
import { ForbiddenError } from "@/lib/auth/access";
import { buildDefaultTemplateSlide } from "@/lib/admin/templates/defaults";

const adminUser = {
  email: "admin@example.com",
  id: "admin-1",
  isActive: true,
  role: "ADMIN"
};

const template = {
  category: "cover-title",
  createdAt: "2026-06-01T00:00:00.000Z",
  customCategoryKey: null,
  customCategoryName: null,
  description: "封面模板",
  id: "template-1",
  isEnabled: true,
  name: "封面模板",
  slide: buildDefaultTemplateSlide("cover-title"),
  sortOrder: 1,
  tags: ["封面"],
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("admin PPT template routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated list requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new auth.UnauthorizedError());

    const response = await GET(new Request("http://localhost/api/admin/templates"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("UNAUTHORIZED");
  });

  it("rejects non-admin list requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new ForbiddenError());

    const response = await GET(new Request("http://localhost/api/admin/templates"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("FORBIDDEN");
  });

  it("lists templates for administrators", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    templates.listPptTemplates.mockResolvedValue([template]);

    const response = await GET(
      new Request("http://localhost/api/admin/templates?category=cover&includeDisabled=false")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(templates.listPptTemplates).toHaveBeenCalledWith({
      category: "cover-title",
      includeDisabled: false
    });
    expect(payload.templates).toHaveLength(1);
  });

  it("creates templates", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    templates.createPptTemplate.mockResolvedValue(template);

    const response = await POST(
      new Request("http://localhost/api/admin/templates", {
        body: JSON.stringify({
          category: "cover",
          name: "封面模板"
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(templates.createPptTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "cover-title",
        name: "封面模板"
      })
    );
    expect(payload.template.id).toBe("template-1");
  });

  it("reads and updates a template", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    templates.getPptTemplate.mockResolvedValue(template);
    templates.updatePptTemplate.mockResolvedValue({
      ...template,
      isEnabled: false
    });

    const readResponse = await GET_ONE(
      new Request("http://localhost/api/admin/templates/template-1"),
      {
        params: Promise.resolve({
          id: "template-1"
        })
      }
    );
    const readPayload = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(readPayload.template.id).toBe("template-1");

    const patchResponse = await PATCH(
      new Request("http://localhost/api/admin/templates/template-1", {
        body: JSON.stringify({
          isEnabled: false
        }),
        method: "PATCH"
      }),
      {
        params: Promise.resolve({
          id: "template-1"
        })
      }
    );
    const patchPayload = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(templates.updatePptTemplate).toHaveBeenCalledWith("template-1", {
      isEnabled: false
    });
    expect(patchPayload.template.isEnabled).toBe(false);
  });

  it("deletes templates", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    templates.deletePptTemplate.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/admin/templates/template-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "template-1"
        })
      }
    );

    expect(response.status).toBe(204);
    expect(templates.deletePptTemplate).toHaveBeenCalledWith("template-1");
  });
});
