import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import zhMessages from "../messages/zh-CN.json";
import { AdminHome } from "@/components/admin/admin-home";

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

function renderAdminHome() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <AdminHome />
    </NextIntlClientProvider>
  );
}

describe("AdminHome", () => {
  it("renders the Chinese admin console entries", () => {
    renderAdminHome();

    expect(
      screen.getByRole("heading", { name: "管理端" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /用户管理/ })).toHaveAttribute(
      "href",
      "/admin/users"
    );
    expect(screen.getByRole("link", { name: /创作工作台/ })).toHaveAttribute(
      "href",
      "/workbench"
    );
  });
});
