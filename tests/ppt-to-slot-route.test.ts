import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  class UnauthorizedError extends Error {}

  return {
    UnauthorizedError,
    requireAdminUser: vi.fn()
  };
});

const service = vi.hoisted(() => ({
  createPptToSlotJob: vi.fn(),
  getPptSlotTemplate: vi.fn(),
  listPptSlotTemplates: vi.fn(),
  readPptSlotTemplateArtifact: vi.fn(),
  updatePptSlotTemplate: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireAdminUser: auth.requireAdminUser
}));

vi.mock("@/lib/admin/ppt-to-slot/service", () => ({
  PptSlotTemplateNotFoundError: class PptSlotTemplateNotFoundError extends Error {},
  PptToSlotValidationError: class PptToSlotValidationError extends Error {
    details: unknown;

    constructor(message: string, details?: unknown) {
      super(message);
      this.details = details;
    }
  },
  createPptToSlotJob: service.createPptToSlotJob,
  getPptSlotTemplate: service.getPptSlotTemplate,
  listPptSlotTemplates: service.listPptSlotTemplates,
  readPptSlotTemplateArtifact: service.readPptSlotTemplateArtifact,
  updatePptSlotTemplate: service.updatePptSlotTemplate
}));

import { GET as GET_ARTIFACT } from "@/app/api/admin/ppt-to-slot/templates/[id]/artifacts/[kind]/route";
import { GET as GET_ONE, PATCH } from "@/app/api/admin/ppt-to-slot/templates/[id]/route";
import { POST } from "@/app/api/admin/ppt-to-slot/jobs/route";
import { GET } from "@/app/api/admin/ppt-to-slot/templates/route";
import { ForbiddenError } from "@/lib/auth/access";

const adminUser = {
  email: "admin@example.com",
  id: "admin-1",
  isActive: true,
  role: "ADMIN"
};

const template = {
  id: "slot-1",
  name: "Slot 模板",
  reviewStatus: "PENDING_REVIEW"
};

describe("PPT--To--Slot admin routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated list requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new auth.UnauthorizedError());

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("UNAUTHORIZED");
  });

  it("rejects non-admin upload requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new ForbiddenError());

    const response = await POST(
      new Request("http://localhost/api/admin/ppt-to-slot/jobs", {
        body: new FormData(),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("FORBIDDEN");
  });

  it("lists and reads templates", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    service.listPptSlotTemplates.mockResolvedValue([template]);
    service.getPptSlotTemplate.mockResolvedValue(template);

    const listResponse = await GET();
    const listPayload = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listPayload.templates).toHaveLength(1);

    const readResponse = await GET_ONE(
      new Request("http://localhost/api/admin/ppt-to-slot/templates/slot-1"),
      {
        params: Promise.resolve({
          id: "slot-1"
        })
      }
    );
    const readPayload = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(readPayload.template.id).toBe("slot-1");
  });

  it("uploads PPTX files and creates a job", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    service.createPptToSlotJob.mockResolvedValue({
      jobId: "job-1",
      templates: [template],
      warnings: []
    });
    const file = {
      arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
      name: "demo.pptx",
      size: 3,
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    };

    const response = await POST({
      formData: async () => ({
        get: (key: string) => (key === "file" ? file : null),
        getAll: () => []
      })
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status, JSON.stringify(payload)).toBe(201);
    expect(payload.jobId).toBe("job-1");
    expect(service.createPptToSlotJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1"
      })
    );
  });

  it("updates review status", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    service.updatePptSlotTemplate.mockResolvedValue({
      ...template,
      reviewStatus: "APPROVED"
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/ppt-to-slot/templates/slot-1", {
        body: JSON.stringify({
          isEnabled: true,
          reviewStatus: "APPROVED"
        }),
        method: "PATCH"
      }),
      {
        params: Promise.resolve({
          id: "slot-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(service.updatePptSlotTemplate).toHaveBeenCalledWith("slot-1", {
      isEnabled: true,
      reviewStatus: "APPROVED"
    });
    expect(payload.template.reviewStatus).toBe("APPROVED");
  });

  it("returns artifacts with content type", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    service.readPptSlotTemplateArtifact.mockResolvedValue({
      bytes: Buffer.from("{}"),
      contentType: "application/json; charset=utf-8",
      filename: "template.json",
      lastModified: new Date("2026-06-05T00:00:00.000Z"),
      sizeBytes: 2
    });

    const response = await GET_ARTIFACT(
      new Request("http://localhost/api/admin/ppt-to-slot/templates/slot-1/artifacts/template"),
      {
        params: Promise.resolve({
          id: "slot-1",
          kind: "template"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(await response.text()).toBe("{}");
  });
});
