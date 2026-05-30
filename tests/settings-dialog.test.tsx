import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import zhMessages from "../messages/zh-CN.json";
import { ExperienceSettingsDialog } from "@/components/settings/experience-settings-dialog";
import { PaletteProvider } from "@/components/theme/palette-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import type {
  AiProviderDto,
  EmbeddingModelDto,
  ImageModelDto,
  LlmModelDto
} from "@/lib/ai-config/types";
import { keepSettingsDialogOpenKey } from "@/lib/settings/dialog-state";

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn()
}));

const navigation = vi.hoisted(() => ({
  pathname: "/workbench",
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn()
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
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    push: navigation.push,
    refresh: navigation.refresh,
    replace: navigation.replace
  })
}));

vi.mock("sonner", () => ({
  toast
}));

const providers: AiProviderDto[] = [
  {
    baseUrl: "http://localhost:11434/v1",
    createdAt: "2026-05-22T00:00:00.000Z",
    hasApiKey: false,
    id: "provider-1",
    isEnabled: true,
    modelCount: 1,
    name: "ollama",
    slug: "ollama",
    updatedAt: "2026-05-22T00:00:00.000Z"
  }
];

const models: LlmModelDto[] = [
  {
    createdAt: "2026-05-22T00:00:00.000Z",
    displayName: "deepseek-v4-flash",
    id: "model-1",
    isDefault: true,
    isEnabled: true,
    kind: "LLM",
    modelId: "deepseek-v4-flash",
    providerId: "provider-1",
    providerName: "ollama",
    providerSlug: "ollama",
    temperature: 0.7,
    updatedAt: "2026-05-22T00:00:00.000Z"
  }
];

const imageModels: ImageModelDto[] = [
  {
    createdAt: "2026-05-30T00:00:00.000Z",
    displayName: "gpt-image-2",
    id: "image-model-1",
    isDefault: true,
    isEnabled: true,
    kind: "IMAGE",
    modelId: "gpt-image-2",
    providerId: "provider-1",
    providerName: "ollama",
    providerSlug: "ollama",
    temperature: 0.7,
    updatedAt: "2026-05-30T00:00:00.000Z"
  }
];

const embeddingModels: EmbeddingModelDto[] = [
  {
    createdAt: "2026-05-30T00:00:00.000Z",
    displayName: "text-embedding-3-small",
    id: "embedding-model-1",
    isDefault: true,
    isEnabled: true,
    kind: "EMBEDDING",
    modelId: "text-embedding-3-small",
    providerId: "provider-1",
    providerName: "ollama",
    providerSlug: "ollama",
    temperature: 0.7,
    updatedAt: "2026-05-30T00:00:00.000Z"
  }
];

const accountUser = {
  avatarUrl: null,
  displayName: "木米禾",
  email: "sjq@example.com",
  id: "user-1",
  isActive: true,
  role: "USER" as const
};

function jsonResponse(value: unknown) {
  return {
    ok: true,
    json: async () => value
  } as Response;
}

function settingsFetchResponse(url: RequestInfo | URL) {
  const requestUrl = String(url);

  if (requestUrl.includes("/api/auth/session")) {
    return jsonResponse({
      authenticated: true,
      user: accountUser
    });
  }

  if (requestUrl.includes("/api/ai/image-models")) {
    return jsonResponse({ imageModels });
  }

  if (requestUrl.includes("/api/ai/embedding-models")) {
    return jsonResponse({ embeddingModels });
  }

  if (requestUrl.includes("/api/ai/providers")) {
    return jsonResponse({ providers });
  }

  return jsonResponse({ models });
}

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <ThemeProvider>
        <PaletteProvider>
          <ExperienceSettingsDialog onOpenChange={vi.fn()} open />
        </PaletteProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

describe("ExperienceSettingsDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-palette");
    document.documentElement.style.colorScheme = "";
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("portals the dialog to the document body so it can center in the viewport", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        return settingsFetchResponse(url);
      })
    );

    render(
      <header>
        <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
          <ThemeProvider>
            <PaletteProvider>
              <ExperienceSettingsDialog onOpenChange={vi.fn()} open />
            </PaletteProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </header>
    );

    const dialog = await screen.findByRole("dialog", { name: "体验设置" });

    expect(dialog.closest("header")).toBeNull();
    expect(document.body).toContainElement(dialog);
  });

  it("shows language and logout controls in general settings", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/auth/logout")) {
        return jsonResponse({});
      }

      return settingsFetchResponse(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();

    expect(
      await screen.findByRole("heading", { name: "通用设置" })
    ).toBeInTheDocument();
    const localeSelect = screen.getByRole("combobox", { name: "语言切换" });

    expect(localeSelect).toHaveValue("zh-CN");
    fireEvent.change(localeSelect, {
      target: {
        value: "en-US"
      }
    });

    expect(window.sessionStorage.getItem(keepSettingsDialogOpenKey)).toBe("1");
    expect(navigation.replace).toHaveBeenCalledWith("/workbench", {
      locale: "en-US"
    });
    expect(screen.getByRole("dialog", { name: "体验设置" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST"
      });
    });
    expect(navigation.push).toHaveBeenCalledWith("/login");
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("does not load AI configuration until an AI settings tab is opened", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/api/auth/session")) {
        return jsonResponse({
          authenticated: true,
          user: accountUser
        });
      }

      return {
        ok: false,
        json: async () => ({ error: "INTERNAL_ERROR" })
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();

    expect(
      await screen.findByRole("heading", { name: "通用设置" })
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/ai/providers");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/ai/models");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/ai/image-models");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("renders provider management and opens the provider form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        return settingsFetchResponse(url);
      })
    );

    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "AI 供应商" }));

    expect(
      await screen.findByRole("heading", { name: "AI 供应商管理" })
    ).toBeInTheDocument();
    expect(await screen.findByText("密钥未配置")).toBeInTheDocument();
    expect(screen.getAllByText("ollama").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "新增供应商" }));

    expect(
      screen.getByRole("heading", { name: "新增供应商" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
  });

  it("keeps provider settings visible when another AI config endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes("/api/ai/image-models")) {
          return {
            ok: false,
            json: async () => ({ error: "INTERNAL_ERROR" })
          } as Response;
        }

        return settingsFetchResponse(url);
      })
    );

    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "AI 供应商" }));

    expect(
      await screen.findByRole("heading", { name: "AI 供应商管理" })
    ).toBeInTheDocument();
    expect(await screen.findByText("密钥未配置")).toBeInTheDocument();
    expect(screen.getAllByText("ollama").length).toBeGreaterThan(0);
    expect(toast.error).toHaveBeenCalledWith("配置加载失败，请稍后重试。");
  });

  it("shows account profile, avatar, and password controls", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void init;

      if (String(url).includes("/api/auth/session")) {
        return jsonResponse({
          authenticated: true,
          user: accountUser
        });
      }

      if (String(url).includes("/api/account/profile")) {
        return jsonResponse({
          user: {
            ...accountUser,
            avatarUrl: "/uploads/avatars/user-1-avatar.png",
            displayName: "SJQ"
          }
        });
      }

      if (String(url).includes("/api/account/password")) {
        return jsonResponse({
          ok: true
        });
      }

      return settingsFetchResponse(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "账号" }));

    expect(
      await screen.findByRole("heading", { name: "账号设置" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("账号（邮箱）")).toHaveValue("sjq@example.com");
    expect(screen.getByLabelText("名称")).toHaveValue("木米禾");

    fireEvent.change(screen.getByLabelText("名称"), {
      target: {
        value: "SJQ"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "上传头像" }));
    fireEvent.change(screen.getByLabelText("头像文件"), {
      target: {
        files: [
          new File(["avatar"], "avatar.png", {
            type: "image/png"
          })
        ]
      }
    });
    expect(await screen.findByText(/avatar\.png/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存资料" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/account/profile",
        expect.objectContaining({
          body: expect.any(FormData),
          method: "PATCH"
        })
      );
    });
    const profileCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/account/profile")
    );
    const profileBody = profileCall?.[1]?.body as FormData;

    expect(profileBody.get("displayName")).toBe("SJQ");
    expect(profileBody.get("avatar")).toBeInstanceOf(File);

    fireEvent.click(screen.getByRole("button", { name: "修改密码" }));
    fireEvent.change(screen.getByLabelText("当前密码"), {
      target: {
        value: "old-password"
      }
    });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: {
        value: "new-password"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存密码" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/account/password",
        expect.objectContaining({
          body: JSON.stringify({
            currentPassword: "old-password",
            newPassword: "new-password"
          }),
          method: "PATCH"
        })
      );
    });
  });

  it("moves theme mode controls into appearance settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        return settingsFetchResponse(url);
      })
    );

    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "外观" }));

    expect(
      await screen.findByRole("heading", { name: "外观设置" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "外观模式" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "配色预设" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "深色模式" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "矩阵" }));

    expect(document.documentElement.dataset.palette).toBe("matrix");
    expect(window.localStorage.getItem("pptcm_palette")).toBe("matrix");
  });

  it("switches to model management and shows the default model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        return settingsFetchResponse(url);
      })
    );

    renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: "LLM 模型" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "LLM 模型管理" })
      ).toBeInTheDocument();
    });
    expect(await screen.findByText("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText("默认")).toBeInTheDocument();
  });

  it("switches to image model management and opens the image model form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => settingsFetchResponse(url))
    );

    renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: "图片模型" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "图片模型管理" })
      ).toBeInTheDocument();
    });
    expect((await screen.findAllByText("gpt-image-2")).length).toBeGreaterThan(
      0
    );

    fireEvent.click(screen.getByRole("button", { name: "新增图片模型" }));

    expect(
      screen.getByRole("heading", { name: "新增图片模型" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("供应商")).toHaveValue("provider-1");
    expect(screen.getByLabelText("默认温度")).toHaveValue(0.7);
  });

  it("manages embedding models with the same model form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => settingsFetchResponse(url))
    );

    renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: "向量模型" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "向量模型管理" })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "新增向量模型" })
    ).toBeEnabled();
    expect(await screen.findByText("text-embedding-3-small")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "新增向量模型" }));

    expect(
      screen.getByRole("heading", { name: "新增向量模型" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("供应商")).toHaveValue("provider-1");
    expect(screen.getByLabelText("默认温度")).toHaveValue(0.7);
  });

  it("fetches provider models and fills the model form from the selection", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const requestUrl = String(url);

      if (requestUrl === "/api/ai/providers/provider-1/models") {
        return jsonResponse({
          models: [
            {
              displayName: "DeepSeek Chat",
              id: "deepseek-chat"
            }
          ]
        });
      }

      if (requestUrl.includes("/api/auth/session")) {
        return jsonResponse({
          authenticated: true,
          user: accountUser
        });
      }

      if (requestUrl.includes("/api/ai/image-models")) {
        return jsonResponse({ imageModels });
      }

      if (requestUrl.includes("/api/ai/embedding-models")) {
        return jsonResponse({ embeddingModels });
      }

      if (requestUrl.includes("/api/ai/providers")) {
        return jsonResponse({ providers });
      }

      return jsonResponse({ models: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "LLM 模型" }));
    const newModelButton = await screen.findByRole("button", {
      name: "新增 LLM 模型"
    });

    await waitFor(() => {
      expect(newModelButton).toBeEnabled();
    });
    fireEvent.click(newModelButton);
    fireEvent.click(screen.getByRole("button", { name: "拉取模型" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ai/providers/provider-1/models"
      );
    });

    fireEvent.change(await screen.findByLabelText("可用模型"), {
      target: {
        value: "deepseek-chat"
      }
    });

    expect(screen.getByLabelText("模型 ID")).toHaveValue("deepseek-chat");
    expect(screen.getByLabelText("显示名称")).toHaveValue("DeepSeek Chat");
  });

  it("shows a migration hint when model save storage is missing", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl === "/api/ai/models" && init?.method === "POST") {
        return {
          ok: false,
          json: async () => ({ error: "DATABASE_MIGRATION_REQUIRED" })
        } as Response;
      }

      if (requestUrl.includes("/api/auth/session")) {
        return jsonResponse({
          authenticated: true,
          user: accountUser
        });
      }

      if (requestUrl.includes("/api/ai/image-models")) {
        return jsonResponse({ imageModels });
      }

      if (requestUrl.includes("/api/ai/embedding-models")) {
        return jsonResponse({ embeddingModels });
      }

      if (requestUrl.includes("/api/ai/providers")) {
        return jsonResponse({ providers });
      }

      return jsonResponse({ models: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "LLM 模型" }));
    const newModelButton = await screen.findByRole("button", {
      name: "新增 LLM 模型"
    });

    await waitFor(() => {
      expect(newModelButton).toBeEnabled();
    });
    fireEvent.click(newModelButton);
    fireEvent.change(screen.getByLabelText("显示名称"), {
      target: {
        value: "deepseek-v4-flash"
      }
    });
    fireEvent.change(screen.getByLabelText("模型 ID"), {
      target: {
        value: "deepseek-v4-flash"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "数据库迁移未完成，请先运行 pnpm db:migrate 后重试。"
      );
    });
  });
});
