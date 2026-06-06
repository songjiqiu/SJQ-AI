import { render, screen, within } from "@testing-library/react";
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
    expect(screen.getByLabelText("管理端入口")).toHaveClass(
      "mx-auto",
      "md:grid-cols-2",
      "max-w-[calc((100%-1rem)*2/3+1rem)]"
    );

    const entries = [
      ["用户管理", "/admin/users"],
      ["PPT模板库管理", "/admin/templates"],
      ["创作工作台", "/workbench"],
      ["PPT--To--Slot", "/admin/ppt-to-slot"]
    ] as const;

    entries.forEach(([title, href]) => {
      const link = screen.getByRole("link", { name: new RegExp(title) });

      expect(link).toHaveAttribute("href", href);
      expect(within(link).getByText(title)).toBeInTheDocument();
      expect(within(link).getByText("进入")).toBeInTheDocument();
    });
  });
});
