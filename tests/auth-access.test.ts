import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getConfiguredAdminEmails,
  resolveUserRoleForEmail
} from "@/lib/auth/access";

describe("auth access helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes configured administrator emails", () => {
    vi.stubEnv("APP_ADMIN_EMAILS", " Admin@Example.COM, owner@example.com ");

    expect(getConfiguredAdminEmails()).toEqual(
      new Set(["admin@example.com", "owner@example.com"])
    );
    expect(resolveUserRoleForEmail("admin@example.com")).toBe("ADMIN");
    expect(resolveUserRoleForEmail("USER@example.com")).toBe("USER");
  });

  it("preserves existing administrator roles when the email is not configured", () => {
    vi.stubEnv("APP_ADMIN_EMAILS", "");

    expect(resolveUserRoleForEmail("admin@example.com", "ADMIN")).toBe("ADMIN");
  });
});
