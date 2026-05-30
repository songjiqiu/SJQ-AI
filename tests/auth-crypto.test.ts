import { describe, expect, it, vi } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  normalizeEmail,
  verifyPassword
} from "@/lib/auth/crypto";

describe("auth crypto helpers", () => {
  it("normalizes email addresses and verifies password hashes", () => {
    const hash = hashPassword("correct-password");

    expect(normalizeEmail("  SJQ@Example.COM ")).toBe("sjq@example.com");
    expect(verifyPassword("correct-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("encrypts API keys without returning plaintext in the stored payload", () => {
    const secret = "test-encryption-secret";
    const encrypted = encryptSecret("sk-test-value", secret);

    expect(encrypted).not.toContain("sk-test-value");
    expect(decryptSecret(encrypted, secret)).toBe("sk-test-value");
  });

  it("requires an encryption key when storing secrets", () => {
    vi.stubEnv("AI_CONFIG_ENCRYPTION_KEY", "");

    expect(() => encryptSecret("sk-test-value")).toThrow(
      /AI_CONFIG_ENCRYPTION_KEY/
    );

    vi.unstubAllEnvs();
  });
});
