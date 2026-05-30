import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import zhMessages from "../messages/zh-CN.json";
import { AuthCard } from "@/components/auth/auth-card";

const navigation = vi.hoisted(() => ({
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
  useRouter: () => ({
    push: navigation.push,
    refresh: navigation.refresh
  })
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

function jsonResponse(value: unknown) {
  return {
    ok: true,
    json: async () => value
  } as Response;
}

function renderAuthCard(mode: "login" | "register") {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <AuthCard mode={mode} />
    </NextIntlClientProvider>
  );
}

function fillAndSubmit(actionName: string) {
  fireEvent.change(screen.getByLabelText("邮箱"), {
    target: { value: "person@example.com" }
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "correct-password" }
  });

  const submitButton = screen.getByRole("button", { name: actionName });
  const form = submitButton.closest("form");

  if (!form) {
    throw new Error("Auth form was not rendered");
  }

  fireEvent.submit(form);
}

describe("AuthCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends administrators to the admin console after login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          user: {
            role: "ADMIN"
          }
        })
      )
    );

    renderAuthCard("login");
    fillAndSubmit("登录");

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/admin");
    });
  });

  it("sends regular users to the workbench after registration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          user: {
            role: "USER"
          }
        })
      )
    );

    renderAuthCard("register");
    fillAndSubmit("注册");

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/workbench");
    });
  });
});
