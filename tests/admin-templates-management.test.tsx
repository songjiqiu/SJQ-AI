import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import zhMessages from "../messages/zh-CN.json";
import { AdminTemplateDesigner } from "@/components/admin/admin-template-designer";
import { AdminTemplatesManagement } from "@/components/admin/admin-templates-management";
import { buildDefaultTemplateSlide } from "@/lib/admin/templates/defaults";
import type { PptTemplateDto } from "@/lib/admin/templates/types";

const router = vi.hoisted(() => ({
  push: vi.fn()
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => router
}));

function jsonResponse(value: unknown, init?: ResponseInit) {
  return {
    ok: init?.status ? init.status >= 200 && init.status < 300 : true,
    json: async () => value,
    status: init?.status ?? 200
  } as Response;
}

const baseTemplate: PptTemplateDto = {
  category: "chapter",
  createdAt: "2026-06-01T00:00:00.000Z",
  customCategoryKey: null,
  customCategoryName: null,
  description: "默认章节页模板",
  id: "template-1",
  isEnabled: true,
  name: "章节页模板",
  slide: buildDefaultTemplateSlide("chapter"),
  sortOrder: 1,
  tags: ["章节页"],
  updatedAt: "2026-06-01T00:00:00.000Z"
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("AdminTemplatesManagement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders categories and templates", () => {
    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);
    const categories = screen.getByLabelText("PPT模板分类");

    expect(
      screen.getByRole("heading", { name: "PPT模板库管理" })
    ).toBeInTheDocument();
    expect(
      within(categories)
        .getAllByRole("button")
        .map((button) => button.textContent?.replace(/\d+$/, "").trim())
    ).toEqual([
      "章节页",
      "封面大标题",
      "标题 + 正文/要点",
      "大图背景",
      "左图右文",
      "左文右图",
      "左文右图表",
      "大图表",
      "双栏对比",
      "引用/金句页",
      "时间轴",
      "流程/步骤",
      "关键指标页",
      "四象限/矩阵",
      "结束页"
    ]);
    expect(within(categories).queryByRole("button", { name: /时间线/ })).not.toBeInTheDocument();
    expect(screen.getByText("章节页模板")).toBeInTheDocument();
  });

  it("renders top actions without the generic create button", () => {
    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    const actionNames = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

    expect(actionNames.indexOf("刷新")).toBeLessThan(
      actionNames.indexOf("导入通用模板")
    );
    expect(actionNames.indexOf("导入通用模板")).toBeLessThan(
      actionNames.indexOf("下载JSON模板格式")
    );
    expect(screen.queryByRole("button", { name: "新建模板" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建章节页" })).toBeInTheDocument();
  });

  it("downloads the JSON import format for the selected category", () => {
    const createObjectUrl = vi.fn(() => "blob:ppt-template-format");
    const revokeObjectUrl = vi.fn();
    const click = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);

    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "下载JSON模板格式" })
    );

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:ppt-template-format");
  });

  it("creates a template in the selected category and opens the designer", async () => {
    const createdTemplate = {
      ...baseTemplate,
      id: "template-created",
      name: "章节页模板 2",
      sortOrder: 2
    };
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        template: createdTemplate
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    fireEvent.click(screen.getByRole("button", { name: "新建章节页" }));
    fireEvent.click(screen.getByRole("button", { name: /使用默认样板创建/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/templates",
        expect.objectContaining({
          method: "POST"
        })
      );
      expect(router.push).toHaveBeenCalledWith(
        "/admin/templates/template-created"
      );
    });
  });

  it("imports a template from the full JSON format", async () => {
    const importedTemplate = {
      ...baseTemplate,
      id: "template-imported",
      name: "导入封面大标题"
    };
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        template: importedTemplate
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    fireEvent.click(screen.getByRole("button", { name: "新建章节页" }));
    fireEvent.change(screen.getByLabelText("选择 JSON 模板文件"), {
      target: {
        files: [
          new File(
            [
              JSON.stringify({
                category: "cover",
                description: "导入说明",
                formatVersion: "ppt-template-import-v1",
                isEnabled: false,
                name: "导入封面大标题",
                slide: buildDefaultTemplateSlide("cover-title"),
                sortOrder: 9,
                tags: ["导入", "封面"]
              })
            ],
            "full-template.json",
            { type: "application/json" }
          )
        ]
      }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/templates",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(body).toMatchObject({
      category: "cover-title",
      description: "导入说明",
      isEnabled: false,
      name: "导入封面大标题",
      sortOrder: 9,
      tags: ["导入", "封面"]
    });
    expect(body.slide.slideId).toBe("template-cover-title");
    expect(router.push).toHaveBeenCalledWith("/admin/templates/template-imported");
  });

  it("wraps a raw SlideCompositionPlan JSON import with current category metadata", async () => {
    const importedTemplate = {
      ...baseTemplate,
      id: "template-raw",
      name: "raw-slide"
    };
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        template: importedTemplate
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    fireEvent.click(screen.getByRole("button", { name: "新建章节页" }));
    fireEvent.change(screen.getByLabelText("选择 JSON 模板文件"), {
      target: {
        files: [
          new File(
            [JSON.stringify(buildDefaultTemplateSlide("chapter"))],
            "raw-slide.json",
            { type: "application/json" }
          )
        ]
      }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(body.category).toBe("chapter");
    expect(body.name).toBe("raw-slide");
    expect(body.tags).toEqual(["章节页"]);
    expect(body.slide.slideId).toBe("template-chapter");
  });

  it("does not call the create API for invalid JSON imports", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    fireEvent.click(screen.getByRole("button", { name: "新建章节页" }));
    fireEvent.change(screen.getByLabelText("选择 JSON 模板文件"), {
      target: {
        files: [
          new File(["not-json"], "broken.json", {
            type: "application/json"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("toggles template enabled status and deletes with confirmation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: true,
          status: 204,
          json: async () => ({})
        } as Response;
      }

      return jsonResponse({
        template: {
          ...baseTemplate,
          isEnabled: false
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    fireEvent.click(screen.getByRole("button", { name: "停用" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/templates/template-1",
        expect.objectContaining({
          body: JSON.stringify({
            isEnabled: false
          }),
          method: "PATCH"
        })
      );
    });
    expect(await screen.findByText("停用")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "确认删除模板"
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/templates/template-1",
        expect.objectContaining({
          method: "DELETE"
        })
      );
    });
  });

  it("imports the universal template package after confirmation", async () => {
    const importedTemplates = [
      {
        ...baseTemplate,
        id: "template-universal",
        name: "章节页 - 章节编号分栏"
      }
    ];
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        createdCount: 45,
        deletedCount: 17,
        templates: importedTemplates
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    fireEvent.click(screen.getByRole("button", { name: "导入通用模板" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "导入通用模板 v1"
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "导入通用模板" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/templates/universal-v1/import",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
    expect(await screen.findByText("章节页 - 章节编号分栏")).toBeInTheDocument();
  });
});

describe("AdminTemplateDesigner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("selects an element, edits its content, adds an element, and saves", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      return jsonResponse({
        template: {
          ...baseTemplate,
          ...body
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });

    renderWithIntl(<AdminTemplateDesigner initialTemplate={baseTemplate} />);

    const titleElement = baseTemplate.slide.elements[0];
    expect(titleElement).toBeDefined();
    fireEvent.pointerDown(
      screen.getByTestId(`template-canvas-element-${titleElement.id}`),
      {
        clientX: 10,
        clientY: 10,
        pointerId: 1
      }
    );
    fireEvent.change(screen.getByLabelText("内容"), {
      target: {
        value: "新的章节页标题"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    fireEvent.click(screen.getByRole("button", { name: "保存模板" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/templates/template-1",
        expect.objectContaining({
          method: "PATCH"
        })
      );
    });
    const lastCall = fetchMock.mock.calls.at(-1);
    const payload = JSON.parse(String(lastCall?.[1]?.body));

    expect(payload.slide.elements.length).toBeGreaterThan(
      baseTemplate.slide.elements.length
    );
    expect(
      payload.slide.elements.some(
        (element: { content?: string }) => element.content === "新的章节页标题"
      )
    ).toBe(true);
  });
});
