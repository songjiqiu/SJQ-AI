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
import { AdminUsersManagement } from "@/components/admin/admin-users-management";
import type { AdminUserDto } from "@/lib/admin/types";

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
  )
}));

const baseUser: AdminUserDto = {
  counts: {
    models: 1,
    providers: 2,
    sessions: 1
  },
  createdAt: "2026-05-22T00:00:00.000Z",
  email: "user@example.com",
  id: "user-1",
  isActive: true,
  role: "USER",
  updatedAt: "2026-05-22T00:00:00.000Z"
};

function jsonResponse(value: unknown) {
  return {
    ok: true,
    json: async () => value
  } as Response;
}

function renderManagement(users: AdminUserDto[], currentUserId = "admin-1") {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <AdminUsersManagement
        currentUserId={currentUserId}
        initialUsers={users}
      />
    </NextIntlClientProvider>
  );
}

describe("AdminUsersManagement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders users and updates roles through the admin API", async () => {
    const updatedUser = {
      ...baseUser,
      role: "ADMIN" as const
    };
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        user: updatedUser
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderManagement([baseUser]);

    expect(
      screen.getByRole("heading", { name: "用户管理" })
    ).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "设为管理员" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user-1",
        expect.objectContaining({
          body: JSON.stringify({
            role: "ADMIN"
          }),
          method: "PATCH"
        })
      );
    });
    expect(await screen.findByText("管理员")).toBeInTheDocument();
  });

  it("prevents editing the current administrator from the UI", () => {
    renderManagement(
      [
        {
          ...baseUser,
          id: "admin-1",
          role: "ADMIN"
        }
      ],
      "admin-1"
    );

    expect(screen.getByRole("button", { name: "设为普通用户" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "禁用" })).toBeDisabled();
    expect(screen.getByText("当前账号")).toBeInTheDocument();
  });

  it("confirms disabling a user with a styled dialog", async () => {
    const updatedUser = {
      ...baseUser,
      isActive: false
    };
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        user: updatedUser
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderManagement([baseUser]);

    fireEvent.click(screen.getByRole("button", { name: "禁用" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "确认禁用账号"
    });

    expect(
      within(dialog).getByText(
        "禁用账号会立即清理该用户的所有登录会话，确定继续吗？"
      )
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "禁用" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user-1",
        expect.objectContaining({
          body: JSON.stringify({
            isActive: false
          }),
          method: "PATCH"
        })
      );
    });
    expect(await screen.findByText("已禁用")).toBeInTheDocument();
  });
});
