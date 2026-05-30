import { describe, expect, it } from "vitest";

import { getRoleLandingPath } from "@/lib/auth/role-landing";

describe("role landing path", () => {
  it("sends administrators to the admin console", () => {
    expect(getRoleLandingPath({ role: "ADMIN" })).toBe("/admin");
  });

  it("sends regular users to the creation workbench", () => {
    expect(getRoleLandingPath({ role: "USER" })).toBe("/workbench");
  });
});
