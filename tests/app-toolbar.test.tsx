import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import zhMessages from "../messages/zh-CN.json";
import { AppToolbar } from "@/components/layout/app-toolbar";
import { keepSettingsDialogOpenKey } from "@/lib/settings/dialog-state";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  refresh: vi.fn()
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
    refresh: navigation.refresh
  })
}));

function jsonResponse(value: unknown) {
  return {
    ok: true,
    json: async () => value
  } as Response;
}

function renderToolbar() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <AppToolbar />
    </NextIntlClientProvider>
  );
}

describe("AppToolbar", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    navigation.pathname = "/";
  });

  it("shows the admin console entry for administrators", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          authenticated: true,
          user: {
            avatarUrl: "/uploads/avatars/admin.png",
            displayName: "木米禾",
            email: "admin@example.com",
            id: "admin-1",
            isActive: true,
            role: "ADMIN"
          }
        })
      )
    );

    renderToolbar();

    expect(await screen.findByLabelText("当前头像")).toHaveAttribute(
      "title",
      "木米禾"
    );
    expect(screen.getByLabelText("当前头像").querySelector("img")).toHaveAttribute(
      "src",
      "/uploads/avatars/admin.png"
    );
    expect(await screen.findByLabelText("管理端")).toHaveAttribute(
      "href",
      "/admin"
    );
    expect(screen.queryByLabelText("语言切换")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("退出登录")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("外观模式")).not.toBeInTheDocument();
  });

  it("hides the admin console entry for regular users", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          authenticated: true,
          user: {
            avatarUrl: null,
            displayName: null,
            email: "user@example.com",
            id: "user-1",
            isActive: true,
            role: "USER"
          }
        })
      )
    );

    renderToolbar();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/session");
    });
    expect(screen.queryByLabelText("管理端")).not.toBeInTheDocument();
    expect(screen.getByLabelText("当前头像")).toHaveTextContent("U");
  });

  it("reopens settings after a locale change marks the dialog to stay open", async () => {
    window.sessionStorage.setItem(keepSettingsDialogOpenKey, "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          authenticated: true,
          user: {
            avatarUrl: null,
            displayName: null,
            email: "user@example.com",
            id: "user-1",
            isActive: true,
            role: "USER"
          }
        })
      )
    );

    renderToolbar();

    expect(
      await screen.findByRole("dialog", { name: "体验设置" })
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(keepSettingsDialogOpenKey)).toBeNull();
  });
});
