import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { TemplateElementAssetKind } from "@prisma/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import zhMessages from "../messages/zh-CN.json";
import { AdminTemplateElementAssetsManagement } from "@/components/admin/admin-template-element-assets-management";
import { AdminTemplatesManagement } from "@/components/admin/admin-templates-management";
import { buildDefaultTemplateSlide } from "@/lib/admin/templates/defaults";
import type { PptTemplateDto } from "@/lib/admin/templates/types";
import type { TemplateElementAssetDto } from "@/lib/admin/template-assets/types";

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

const baseAsset: TemplateElementAssetDto = {
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
  description: "适合流程节点和观点表达",
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
  reviewStatus: "APPROVED",
  semanticTags: ["idea", "concept"],
  secondaryCategory: "result-status",
  setKey: "common",
  setKind: "COMMON",
  setName: "通用套装",
  sortOrder: 1,
  source: "MANUAL",
  style: {
    cornerRadius: 12,
    strokeColor: "#2563eb",
    strokeWidth: 2
  },
  styleTags: ["minimal"],
  synonyms: ["concept"],
  tags: ["图标"],
  updatedAt: "2026-06-02T00:00:00.000Z",
  usageScenarios: ["feature"],
  variantKey: "warning"
};

function buildAsset(
  overrides: Partial<TemplateElementAssetDto>
): TemplateElementAssetDto {
  return {
    ...baseAsset,
    ...overrides,
    aiModifyPermissions: {
      ...baseAsset.aiModifyPermissions,
      ...overrides.aiModifyPermissions
    },
    backgroundModes: overrides.backgroundModes ?? baseAsset.backgroundModes,
    colorTags: overrides.colorTags ?? baseAsset.colorTags,
    keywords: overrides.keywords ?? baseAsset.keywords,
    pageTypes: overrides.pageTypes ?? baseAsset.pageTypes,
    preview: overrides.preview ?? baseAsset.preview,
    resource: overrides.resource ?? baseAsset.resource,
    semanticTags: overrides.semanticTags ?? baseAsset.semanticTags,
    style: overrides.style ?? baseAsset.style,
    styleTags: overrides.styleTags ?? baseAsset.styleTags,
    synonyms: overrides.synonyms ?? baseAsset.synonyms,
    tags: overrides.tags ?? baseAsset.tags,
    usageScenarios: overrides.usageScenarios ?? baseAsset.usageScenarios
  };
}

function buildShapeAsset(
  overrides: Partial<TemplateElementAssetDto>
): TemplateElementAssetDto {
  return buildAsset({
    kind: TemplateElementAssetKind.SHAPE,
    name: "测试图形",
    preview: {
      shape: "roundedRect"
    },
    primaryCategory: "basic-geometry",
    resource: {
      shapeType: "roundedRect",
      type: "ppt-shape"
    },
    secondaryCategory: "rect-geometry",
    style: {
      cornerRadius: 8,
      fillColor: "#f8fafc",
      shapeType: "roundedRect",
      strokeColor: "#2563eb",
      strokeWidth: 1
    },
    variantKey: "rect",
    ...overrides
  });
}

function buildContainerAsset(
  overrides: Partial<TemplateElementAssetDto>
): TemplateElementAssetDto {
  return buildAsset({
    kind: TemplateElementAssetKind.CONTAINER,
    name: "测试容器",
    preview: {
      shape: "container"
    },
    primaryCategory: "content-carrier",
    resource: {},
    secondaryCategory: "text-container",
    style: {
      allowedContentTypes: ["text"],
      fillColor: "#f8fafc",
      recommendedHeight: 170,
      recommendedWidth: 320,
      strokeColor: "#2563eb",
      strokeWidth: 1
    },
    variantKey: "body-text-area",
    ...overrides
  });
}

function buildNavigationAsset(
  overrides: Partial<TemplateElementAssetDto>
): TemplateElementAssetDto {
  return buildAsset({
    kind: TemplateElementAssetKind.NAVIGATION,
    name: "测试导航",
    preview: {
      shape: "navigation"
    },
    primaryCategory: "deck-navigation",
    resource: {},
    secondaryCategory: "table-of-contents",
    style: {
      activeColor: "#2563eb",
      inactiveColor: "#94a3b8"
    },
    variantKey: "toc-list",
    ...overrides
  });
}

function buildTextStyleAsset(
  overrides: Partial<TemplateElementAssetDto>
): TemplateElementAssetDto {
  return buildAsset({
    kind: TemplateElementAssetKind.TEXT_STYLE,
    name: "测试文本样式",
    preview: {
      shape: "textStyle"
    },
    primaryCategory: "body-hierarchy",
    resource: {},
    secondaryCategory: "body-text",
    style: {
      color: "#111827",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.35
    },
    variantKey: "paragraph",
    ...overrides
  });
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

describe("AdminTemplateElementAssetsManagement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("adds template workspace navigation without changing template route", () => {
    renderWithIntl(<AdminTemplatesManagement initialTemplates={[baseTemplate]} />);

    expect(
      screen.getByRole("link", { name: /模板管理/ })
    ).toHaveAttribute("href", "/admin/templates");
    expect(screen.getByRole("link", { name: /图标管理/ })).toHaveAttribute(
      "href",
      "/admin/templates/icons"
    );
    expect(screen.getByRole("link", { name: /图形管理/ })).toHaveAttribute(
      "href",
      "/admin/templates/shapes"
    );
    expect(screen.getByRole("link", { name: /线条管理/ })).toHaveAttribute(
      "href",
      "/admin/templates/lines"
    );
    expect(screen.getByRole("link", { name: /文本样式管理/ })).toHaveAttribute(
      "href",
      "/admin/templates/text-styles"
    );
    expect(screen.getByRole("link", { name: /容器组件管理/ })).toHaveAttribute(
      "href",
      "/admin/templates/containers"
    );
    expect(screen.getByRole("link", { name: /导航组件管理/ })).toHaveAttribute(
      "href",
      "/admin/templates/navigation"
    );
  });

  it("renders icon assets and filters by semantic tags", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[baseAsset]}
        kind={TemplateElementAssetKind.ICON}
      />
    );

    expect(screen.getByRole("heading", { name: "图标管理" })).toBeInTheDocument();
    expect(screen.getByText("概念图标")).toBeInTheDocument();
    expect(screen.getByText("状态反馈 / 结果状态 / 警告")).toBeInTheDocument();
    expect(screen.queryByText("通用套装 · 通用套装")).not.toBeInTheDocument();
    expect(screen.getAllByText("已入库").length).toBeGreaterThan(0);
    expect(screen.getByText("适合流程节点和观点表达")).toBeInTheDocument();
    expect(screen.getByText("idea")).toBeInTheDocument();
    expect(screen.getByText("concept")).toBeInTheDocument();
    expect(screen.queryByText("title-body-points")).not.toBeInTheDocument();
    expect(screen.queryByText("light")).not.toBeInTheDocument();
    expect(screen.queryByText("dark")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停用" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "批量导入" })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("语义元素资产列表")).getByRole("button", {
        name: "新增资产"
      })
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(
        "搜索名称、说明、套装、语义、关键词、页面类型、风格或背景"
      ),
      {
        target: {
          value: "concept"
        }
      }
    );

    expect(screen.getByText("概念图标")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(
        "搜索名称、说明、套装、语义、关键词、页面类型、风格或背景"
      ),
      {
        target: {
          value: "missing"
        }
      }
    );

    expect(screen.queryByText("概念图标")).not.toBeInTheDocument();
    expect(screen.getByText("当前分类暂无资产")).toBeInTheDocument();
  });

  it("folds page type, style, and background filters into search", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          baseAsset,
          buildAsset({
            backgroundModes: ["transparent"],
            id: "asset-2",
            name: "深色展示图标",
            pageTypes: ["cover-title"],
            styleTags: ["editorial"]
          })
        ]}
        kind={TemplateElementAssetKind.ICON}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      "搜索名称、说明、套装、语义、关键词、页面类型、风格或背景"
    );

    expect(screen.queryByLabelText("页面类型")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("风格标签")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("背景适配")).not.toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: {
        value: "cover-title"
      }
    });
    expect(screen.getByText("深色展示图标")).toBeInTheDocument();
    expect(screen.queryByText("概念图标")).not.toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: {
        value: "封面大标题"
      }
    });
    expect(screen.getByText("深色展示图标")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: {
        value: "editorial"
      }
    });
    expect(screen.getByText("深色展示图标")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: {
        value: "transparent"
      }
    });
    expect(screen.getByText("深色展示图标")).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: {
        value: "透明背景"
      }
    });
    expect(screen.getByText("深色展示图标")).toBeInTheDocument();
  });

  it("filters assets by the three-level category path", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          baseAsset,
          {
            ...baseAsset,
            id: "asset-2",
            name: "日历图标",
            primaryCategory: "time-progress",
            secondaryCategory: "time-object",
            variantKey: "calendar"
          }
        ]}
        kind={TemplateElementAssetKind.ICON}
      />
    );

    fireEvent.change(screen.getAllByLabelText("主类目")[0], {
      target: {
        value: "status-feedback"
      }
    });
    fireEvent.change(screen.getAllByLabelText("二级语义")[0], {
      target: {
        value: "result-status"
      }
    });
    fireEvent.change(screen.getAllByLabelText("资源变体")[0], {
      target: {
        value: "warning"
      }
    });

    expect(screen.getByText("概念图标")).toBeInTheDocument();
    expect(screen.queryByText("日历图标")).not.toBeInTheDocument();
  });

  it("creates a new line asset from the form JSON", async () => {
    const createdAsset = {
      ...baseAsset,
      id: "asset-created",
      kind: TemplateElementAssetKind.LINE,
      name: "圆角箭头连接线"
    };
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        asset: createdAsset
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[]}
        kind={TemplateElementAssetKind.LINE}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "新增资产" })[0]);
    fireEvent.change(screen.getByLabelText("资产名称"), {
      target: {
        value: "圆角箭头连接线"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存资产" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/template-assets",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const firstCall = fetchMock.mock.calls[0];
    const body = JSON.parse(String(firstCall?.[1]?.body));
    expect(body.kind).toBe("LINE");
    expect(body.name).toBe("圆角箭头连接线");
    expect(body.primaryCategory).toBe("basic-line");
    expect(body.secondaryCategory).toBe("straight-line");
    expect(body.variantKey).toBe("straight-line");
    expect(body.reviewStatus).toBe("APPROVED");
    expect(body.setKind).toBe("COMMON");
    expect(body.setKey).toBe("common");
    expect(body.aiModifyPermissions.allowMove).toBe(true);
    expect(body.style).toEqual(
      expect.objectContaining({
        strokeColor: "#2563eb"
      })
    );
    expect(screen.getByText("圆角箭头连接线")).toBeInTheDocument();
  });

  it("applies category recommendations in the asset form", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));

      return jsonResponse({
        asset: {
          ...baseAsset,
          ...body,
          id: "asset-category"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[]}
        kind={TemplateElementAssetKind.ICON}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "新增资产" })[0]);
    fireEvent.change(screen.getAllByLabelText("主类目")[1], {
      target: {
        value: "status-feedback"
      }
    });
    fireEvent.change(screen.getAllByLabelText("二级语义")[1], {
      target: {
        value: "result-status"
      }
    });
    fireEvent.change(screen.getAllByLabelText("资源变体")[1], {
      target: {
        value: "warning"
      }
    });

    expect(screen.getByLabelText("资产名称")).toHaveValue("警告图标");
    fireEvent.click(screen.getByRole("button", { name: "保存资产" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.primaryCategory).toBe("status-feedback");
    expect(body.secondaryCategory).toBe("result-status");
    expect(body.variantKey).toBe("warning");
    expect(body.semanticTags).toContain("警告");
  });

  it("keeps JSON configuration collapsed until opened and saves edited JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));

      return jsonResponse({
        asset: {
          ...baseAsset,
          ...body,
          id: "asset-json"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[]}
        kind={TemplateElementAssetKind.ICON}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "新增资产" })[0]);
    expect(screen.getByText("基础信息")).toBeInTheDocument();
    expect(screen.getByText("检索标签")).toBeInTheDocument();
    const previewPanel = screen.getByLabelText("预览");
    expect(within(previewPanel).getByText("套装")).toBeInTheDocument();
    expect(within(previewPanel).getByText("审核")).toBeInTheDocument();
    expect(within(previewPanel).getByText("来源")).toBeInTheDocument();
    const jsonSectionSummary = screen.getByText("JSON 配置");
    const jsonSection = jsonSectionSummary.closest("details");
    expect(jsonSection).not.toHaveAttribute("open");

    fireEvent.click(jsonSectionSummary);
    expect(jsonSection).toHaveAttribute("open");
    const styleJsonInput = screen.getByLabelText("样式 JSON");
    fireEvent.change(styleJsonInput, {
      target: {
        value: JSON.stringify(
          {
            cornerRadius: 8,
            strokeColor: "#ef4444",
            strokeWidth: 3
          },
          null,
          2
        )
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存资产" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.style).toEqual(
      expect.objectContaining({
        strokeColor: "#ef4444",
        strokeWidth: 3
      })
    );
    expect(body.resource).toEqual({});
    expect(body.preview).toEqual(
      expect.objectContaining({
        iconName: expect.any(String)
      })
    );
  });

  it("renders text style assets with the shared resource manager", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          {
            ...baseAsset,
            kind: TemplateElementAssetKind.TEXT_STYLE,
            name: "封面标题样式",
            preview: {
              sampleText: "标题层级",
              shape: "textStyle"
            },
            primaryCategory: "title-hierarchy",
            secondaryCategory: "deck-title",
            semanticTags: ["封面主标题", "标题层级"],
            style: {
              color: "#111827",
              fontSize: 32,
              fontWeight: 700
            },
            variantKey: "cover-title"
          }
        ]}
        kind={TemplateElementAssetKind.TEXT_STYLE}
      />
    );

    expect(
      screen.getByRole("heading", { name: "文本样式管理" })
    ).toBeInTheDocument();
    expect(screen.getByText("封面标题样式")).toBeInTheDocument();
    expect(screen.getByText("标题层级 / 整套标题 / 封面主标题")).toBeInTheDocument();
  });

  it("renders semantic previews for all asset kinds on list cards", () => {
    const assets = [
      buildAsset({
        id: "icon-home",
        kind: TemplateElementAssetKind.ICON,
        name: "首页图标",
        preview: {
          iconName: "home"
        },
        resource: {
          semanticKey: "home",
          type: "line-icon"
        },
        variantKey: "home"
      }),
      buildAsset({
        id: "line-arrow",
        kind: TemplateElementAssetKind.LINE,
        name: "右箭头线条",
        preview: {
          direction: "right",
          lineType: "arrow"
        },
        resource: {
          connectorType: "straight",
          endArrowType: "triangle",
          startArrowType: "none"
        },
        style: {
          dash: "solid",
          strokeColor: "#2563eb",
          strokeWidth: 2
        },
        variantKey: "right-arrow"
      }),
      buildAsset({
        id: "text-number",
        kind: TemplateElementAssetKind.TEXT_STYLE,
        name: "数字强调文本样式",
        preview: {
          sampleText: "128%"
        },
        resource: {
          textRole: "number-emphasis"
        },
        style: {
          color: "#111827",
          fontSize: 38,
          fontWeight: 700,
          lineHeight: 1.1
        },
        variantKey: "number-emphasis"
      }),
      buildAsset({
        id: "container-metric",
        kind: TemplateElementAssetKind.CONTAINER,
        name: "指标卡片容器",
        preview: {
          shape: "container"
        },
        resource: {
          containerRole: "metric-card"
        },
        style: {
          allowedContentTypes: ["metric", "text"],
          fillColor: "#f8fafc",
          recommendedHeight: 150,
          recommendedWidth: 320,
          strokeColor: "#2563eb",
          strokeWidth: 1
        },
        variantKey: "metric-card"
      }),
      buildAsset({
        id: "nav-progress",
        kind: TemplateElementAssetKind.NAVIGATION,
        name: "线性进度导航",
        preview: {
          shape: "progress"
        },
        resource: {
          navigationRole: "linear-progress"
        },
        style: {
          activeColor: "#2563eb",
          displayMode: "progress",
          inactiveColor: "#94a3b8"
        },
        variantKey: "linear-progress"
      })
    ];

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={assets}
        kind={TemplateElementAssetKind.ICON}
      />
    );

    expect(document.querySelector('[data-preview-kind="icon"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-key="home"]')).toBeInTheDocument();

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={assets}
        kind={TemplateElementAssetKind.LINE}
      />
    );
    expect(document.querySelector('[data-preview-line="arrow"]')).toBeInTheDocument();
    expect(
      document.querySelector('[data-preview-direction="right"]')
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-preview-start-arrow="none"]')
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-preview-end-arrow="triangle"]')
    ).toBeInTheDocument();

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={assets}
        kind={TemplateElementAssetKind.TEXT_STYLE}
      />
    );
    expect(
      document.querySelector('[data-preview-text-role="number-emphasis"]')
    ).toBeInTheDocument();

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={assets}
        kind={TemplateElementAssetKind.CONTAINER}
      />
    );
    expect(
      document.querySelector('[data-preview-container="metric-card"]')
    ).toBeInTheDocument();

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={assets}
        kind={TemplateElementAssetKind.NAVIGATION}
      />
    );
    expect(
      document.querySelector('[data-preview-navigation="linear-progress"]')
    ).toBeInTheDocument();
  });

  it("uses the same enhanced preview in the edit dialog", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildAsset({
            id: "line-elbow",
            kind: TemplateElementAssetKind.LINE,
            name: "肘形连接线",
            preview: {},
            resource: {
              connectorType: "elbow",
              endArrowType: "triangle"
            },
            style: {
              strokeColor: "#2563eb",
              strokeWidth: 2
            },
            variantKey: "node-connector"
          })
        ]}
        kind={TemplateElementAssetKind.LINE}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    expect(
      screen.getByLabelText("预览").querySelector('[data-preview-line="elbow"]')
    ).toBeInTheDocument();
  });

  it("infers container previews from variant keys when old JSON stores generic containers", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildContainerAsset({
            id: "container-image",
            name: "图片区域容器",
            secondaryCategory: "media-container",
            variantKey: "image-area"
          }),
          buildContainerAsset({
            id: "container-chart",
            name: "图表区域容器",
            secondaryCategory: "media-container",
            variantKey: "chart-area"
          }),
          buildContainerAsset({
            id: "container-metric-old",
            name: "指标卡片容器",
            secondaryCategory: "hybrid-container",
            variantKey: "metric-card"
          }),
          buildContainerAsset({
            id: "container-columns",
            name: "双栏容器",
            primaryCategory: "layout-container",
            secondaryCategory: "columns",
            variantKey: "two-column"
          }),
          buildContainerAsset({
            id: "container-list",
            name: "清单容器",
            primaryCategory: "layout-container",
            secondaryCategory: "list-container",
            variantKey: "check-list"
          }),
          buildContainerAsset({
            id: "container-warning",
            name: "警示框容器",
            primaryCategory: "layout-container",
            secondaryCategory: "emphasis-container",
            variantKey: "warning-box"
          })
        ]}
        kind={TemplateElementAssetKind.CONTAINER}
      />
    );

    expect(document.querySelector('[data-preview-container="image-area"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container-content="image"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container="chart-area"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container-content="chart"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container="metric-card"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container-content="metric"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container="two-column"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container-content="columns"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container="check-list"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container-content="list"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container="warning-box"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-container-content="emphasis"]')).toBeInTheDocument();
  });

  it("infers navigation preview modes from variants when display mode is missing", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildNavigationAsset({
            id: "nav-grid-old",
            name: "目录网格导航",
            variantKey: "toc-grid"
          }),
          buildNavigationAsset({
            id: "nav-sidebar-old",
            name: "侧边目录导航",
            variantKey: "toc-sidebar"
          }),
          buildNavigationAsset({
            id: "nav-page-old",
            name: "页码导航",
            secondaryCategory: "page-index",
            variantKey: "page-number"
          }),
          buildNavigationAsset({
            id: "nav-progress-old",
            name: "线性进度导航",
            primaryCategory: "progress-navigation",
            secondaryCategory: "progress-bar",
            variantKey: "linear-progress"
          }),
          buildNavigationAsset({
            id: "nav-dot-old",
            name: "圆点进度导航",
            primaryCategory: "progress-navigation",
            secondaryCategory: "progress-bar",
            variantKey: "dot-progress"
          }),
          buildNavigationAsset({
            id: "nav-step-old",
            name: "当前步骤导航",
            primaryCategory: "progress-navigation",
            secondaryCategory: "step-indicator",
            variantKey: "current-step"
          })
        ]}
        kind={TemplateElementAssetKind.NAVIGATION}
      />
    );

    expect(document.querySelector('[data-preview-navigation="toc-grid"][data-preview-mode="grid"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-navigation="toc-sidebar"][data-preview-mode="list"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-navigation="page-number"][data-preview-mode="label"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-navigation="linear-progress"][data-preview-mode="progress"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-navigation="dot-progress"][data-preview-mode="progress"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-navigation="current-step"][data-preview-mode="step"]')).toBeInTheDocument();
  });

  it("infers text style roles from variants when resource metadata is missing", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildTextStyleAsset({
            id: "text-subtitle-old",
            name: "封面副标题样式",
            primaryCategory: "title-hierarchy",
            secondaryCategory: "deck-title",
            style: {
              color: "#111827",
              fontSize: 28,
              fontWeight: 400
            },
            variantKey: "cover-subtitle"
          }),
          buildTextStyleAsset({
            id: "text-bullet-old",
            name: "要点样式",
            variantKey: "bullet-point"
          }),
          buildTextStyleAsset({
            id: "text-tag-old",
            name: "标签样式",
            secondaryCategory: "special-text",
            variantKey: "tag"
          }),
          buildTextStyleAsset({
            id: "text-source-old",
            name: "来源说明样式",
            secondaryCategory: "header-footer",
            variantKey: "source-note"
          }),
          buildTextStyleAsset({
            id: "text-number-old",
            name: "数字强调样式",
            secondaryCategory: "special-text",
            style: {
              color: "#2563eb",
              fontSize: 38,
              fontWeight: 700
            },
            variantKey: "number-emphasis"
          })
        ]}
        kind={TemplateElementAssetKind.TEXT_STYLE}
      />
    );

    expect(document.querySelector('[data-preview-text-role="cover-subtitle"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-text-role="bullet-point"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-text-role="tag"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-text-role="source-note"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-text-role="number-emphasis"]')).toBeInTheDocument();
    expect(screen.getByText("战略简报副标题")).toBeInTheDocument();
    expect(screen.getByText("关键要点")).toBeInTheDocument();
    expect(screen.getByText("来源说明")).toBeInTheDocument();
    expect(screen.getByText("128%")).toBeInTheDocument();
  });

  it("renders line arrow variants with distinct arrowheads and directions", () => {
    const assets = [
      buildAsset({
        id: "line-no-arrow",
        kind: TemplateElementAssetKind.LINE,
        name: "无箭头线条",
        preview: {
          direction: "horizontal",
          lineType: "straight"
        },
        resource: {
          connectorType: "straight",
          endArrowType: "none",
          startArrowType: "none"
        },
        variantKey: "no-arrow-line"
      }),
      buildAsset({
        id: "line-one-way",
        kind: TemplateElementAssetKind.LINE,
        name: "单向箭头",
        preview: {
          direction: "right",
          lineType: "arrow"
        },
        resource: {
          connectorType: "straight",
          endArrowType: "triangle",
          startArrowType: "none"
        },
        variantKey: "one-way-arrow"
      }),
      buildAsset({
        id: "line-two-way",
        kind: TemplateElementAssetKind.LINE,
        name: "双向箭头",
        preview: {
          direction: "horizontal",
          lineType: "arrow"
        },
        resource: {
          connectorType: "straight",
          endArrowType: "triangle",
          startArrowType: "triangle"
        },
        variantKey: "two-way-arrow"
      }),
      buildAsset({
        id: "line-left",
        kind: TemplateElementAssetKind.LINE,
        name: "左箭头",
        preview: {
          direction: "left",
          lineType: "arrow"
        },
        resource: {
          connectorType: "straight",
          endArrowType: "triangle",
          startArrowType: "none"
        },
        variantKey: "left-arrow"
      }),
      buildAsset({
        id: "line-up",
        kind: TemplateElementAssetKind.LINE,
        name: "上箭头",
        preview: {
          direction: "up",
          lineType: "arrow"
        },
        resource: {
          connectorType: "straight",
          endArrowType: "triangle",
          startArrowType: "none"
        },
        variantKey: "up-arrow"
      }),
      buildAsset({
        id: "line-down",
        kind: TemplateElementAssetKind.LINE,
        name: "下箭头",
        preview: {
          direction: "down",
          lineType: "arrow"
        },
        resource: {
          connectorType: "straight",
          endArrowType: "triangle",
          startArrowType: "none"
        },
        variantKey: "down-arrow"
      })
    ];

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={assets}
        kind={TemplateElementAssetKind.LINE}
      />
    );

    const noArrowPreview = document.querySelector(
      '[data-preview-line="straight"][data-preview-start-arrow="none"][data-preview-end-arrow="none"]'
    );
    expect(noArrowPreview).toBeInTheDocument();
    expect(noArrowPreview?.querySelector("[marker-end]")).not.toBeInTheDocument();

    expect(
      document.querySelector(
        '[data-preview-line="arrow"][data-preview-direction="right"][data-preview-start-arrow="none"][data-preview-end-arrow="triangle"]'
      )
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-preview-line="arrow"][data-preview-direction="horizontal"][data-preview-start-arrow="triangle"][data-preview-end-arrow="triangle"]'
      )
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-preview-direction="left"] [data-preview-path="main"]')
    ).toHaveAttribute("d", "M164 56 H28");
    expect(
      document.querySelector('[data-preview-direction="up"] [data-preview-path="main"]')
    ).toHaveAttribute("d", "M96 88 V24");
    expect(
      document.querySelector('[data-preview-direction="down"] [data-preview-path="main"]')
    ).toHaveAttribute("d", "M96 24 V88");
  });

  it("corrects legacy line metadata from the variant key during preview", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildAsset({
            id: "line-legacy-no-arrow",
            kind: TemplateElementAssetKind.LINE,
            name: "旧数据无箭头",
            preview: {
              lineType: "arrow"
            },
            resource: {
              connectorType: "straight",
              endArrowType: "triangle",
              startArrowType: "none"
            },
            variantKey: "no-arrow-line"
          }),
          buildAsset({
            id: "line-legacy-two-way",
            kind: TemplateElementAssetKind.LINE,
            name: "旧数据双向箭头",
            preview: {
              lineType: "arrow"
            },
            resource: {
              connectorType: "straight",
              endArrowType: "triangle",
              startArrowType: "none"
            },
            variantKey: "two-way-arrow"
          }),
          buildAsset({
            id: "line-legacy-up",
            kind: TemplateElementAssetKind.LINE,
            name: "旧数据上箭头",
            preview: {
              lineType: "arrow"
            },
            resource: {
              connectorType: "straight",
              endArrowType: "triangle",
              startArrowType: "none"
            },
            variantKey: "up-arrow"
          })
        ]}
        kind={TemplateElementAssetKind.LINE}
      />
    );

    expect(
      document.querySelector(
        '[data-preview-line="straight"][data-preview-start-arrow="none"][data-preview-end-arrow="none"]'
      )
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-preview-line="arrow"][data-preview-start-arrow="triangle"][data-preview-end-arrow="triangle"]'
      )
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-preview-direction="up"] [data-preview-path="main"]')
    ).toHaveAttribute("d", "M96 88 V24");
  });

  it("renders circle shape assets from basic geometry variant instead of old ellipse JSON", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildShapeAsset({
            name: "圆形图形（通用V1）",
            preview: {
              label: "圆形",
              shape: "ellipse"
            },
            resource: {
              shapeType: "ellipse",
              type: "ppt-shape"
            },
            secondaryCategory: "round-geometry",
            style: {
              cornerRadius: 999,
              fillColor: "#f8fafc",
              shapeType: "ellipse",
              strokeColor: "#2563eb",
              strokeWidth: 1
            },
            variantKey: "circle"
          })
        ]}
        kind={TemplateElementAssetKind.SHAPE}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    expect(
      screen.getByLabelText("预览").querySelector('[data-preview-shape="circle"]')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("预览").querySelector('[data-preview-shape="ellipse"]')
    ).not.toBeInTheDocument();
  });

  it("infers round geometry previews from variant keys when old JSON stores rounded rectangles", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildShapeAsset({
            id: "ellipse-shape",
            name: "椭圆图形（通用V1）",
            secondaryCategory: "round-geometry",
            variantKey: "ellipse"
          }),
          buildShapeAsset({
            id: "sector-shape",
            name: "扇形图形（通用V1）",
            secondaryCategory: "round-geometry",
            variantKey: "sector"
          }),
          buildShapeAsset({
            id: "arc-shape",
            name: "弧形图形（通用V1）",
            secondaryCategory: "round-geometry",
            variantKey: "arc"
          })
        ]}
        kind={TemplateElementAssetKind.SHAPE}
      />
    );

    expect(document.querySelector('[data-preview-shape="ellipse"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-shape="sector"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-shape="arc"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-preview-shape="roundedRect"]')).toHaveLength(0);
  });

  it("renders rectangular and polygon geometry previews as SVG shapes", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildShapeAsset({
            id: "parallelogram-shape",
            name: "平行四边形图形（通用V1）",
            variantKey: "parallelogram"
          }),
          buildShapeAsset({
            id: "trapezoid-shape",
            name: "梯形图形（通用V1）",
            secondaryCategory: "polygon-geometry",
            variantKey: "trapezoid"
          }),
          buildShapeAsset({
            id: "hexagon-shape",
            name: "六边形图形（通用V1）",
            secondaryCategory: "polygon-geometry",
            variantKey: "hexagon"
          })
        ]}
        kind={TemplateElementAssetKind.SHAPE}
      />
    );

    expect(document.querySelector('[data-preview-shape="parallelogram"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-shape="trapezoid"]')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-shape="hexagon"]')).toBeInTheDocument();
  });

  it("renders triangle previews with visible SVG stroke instead of CSS borders", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildShapeAsset({
            name: "三角形图形（通用V1）",
            preview: {
              shape: "triangle"
            },
            resource: {
              shapeType: "triangle",
              type: "ppt-shape"
            },
            secondaryCategory: "polygon-geometry",
            style: {
              fillColor: "#f8fafc",
              shapeType: "triangle",
              strokeColor: "#2563eb",
              strokeWidth: 1
            },
            variantKey: "triangle"
          })
        ]}
        kind={TemplateElementAssetKind.SHAPE}
      />
    );

    const trianglePreview = document.querySelector('[data-preview-shape="triangle"]');

    expect(trianglePreview?.tagName.toLowerCase()).toBe("svg");
    expect(trianglePreview?.querySelector("polygon")).toHaveAttribute(
      "stroke",
      "#2563eb"
    );
  });

  it("falls back to resource shape type when shape preview JSON is missing", () => {
    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[
          buildShapeAsset({
            name: "菱形图形",
            preview: {},
            resource: {
              shapeType: "diamond",
              type: "ppt-shape"
            },
            secondaryCategory: "polygon-geometry",
            style: {
              fillColor: "#f8fafc",
              strokeColor: "#2563eb",
              strokeWidth: 1
            },
            variantKey: "diamond"
          })
        ]}
        kind={TemplateElementAssetKind.SHAPE}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    expect(
      screen.getByLabelText("预览").querySelector('[data-preview-shape="diamond"]')
    ).toBeInTheDocument();
  });

  it("edits, disables, and deletes assets", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));

        return jsonResponse({
          asset: {
            ...baseAsset,
            ...body,
            isEnabled:
              typeof body.isEnabled === "boolean"
                ? body.isEnabled
                : baseAsset.isEnabled,
            name: body.name ?? baseAsset.name
          }
        });
      }

      if (init?.method === "DELETE") {
        return {
          ok: true,
          status: 204
        } as Response;
      }

      return jsonResponse({
        assets: [baseAsset]
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(
      <AdminTemplateElementAssetsManagement
        initialAssets={[baseAsset]}
        kind={TemplateElementAssetKind.ICON}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("资产名称"), {
      target: {
        value: "更新图标"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存资产" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/template-assets/asset-1",
        expect.objectContaining({
          method: "PATCH"
        })
      );
    });
    expect(screen.getByText("更新图标")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "停用" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/template-assets/asset-1",
        expect.objectContaining({
          body: expect.stringContaining('"isEnabled":false'),
          method: "PATCH"
        })
      );
    });

    const assetCards = screen.getByLabelText("语义元素资产列表");
    fireEvent.click(within(assetCards).getByRole("button", { name: "删除" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "删除"
      })
    );

    await waitFor(() => {
      expect(screen.queryByText("更新图标")).not.toBeInTheDocument();
    });
  });
});
