import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireCurrentUser: vi.fn()
}));

const account = vi.hoisted(() => {
  class InvalidCurrentPasswordError extends Error {}

  return {
    InvalidCurrentPasswordError,
    updateAccountPassword: vi.fn(),
    updateAccountProfile: vi.fn()
  };
});

const avatarStorage = vi.hoisted(() => ({
  AvatarUploadValidationError: class AvatarUploadValidationError extends Error {},
  deleteStoredAvatar: vi.fn(),
  saveAvatarFile: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireCurrentUser: auth.requireCurrentUser
}));

vi.mock("@/lib/account/service", () => account);

vi.mock("@/lib/account/avatar-storage", () => avatarStorage);

import { PATCH as PATCH_PASSWORD } from "@/app/api/account/password/route";
import { PATCH as PATCH_PROFILE } from "@/app/api/account/profile/route";

const currentUser = {
  avatarUrl: "/uploads/avatars/old-avatar.png",
  displayName: null,
  email: "sjq@example.com",
  id: "user-1",
  isActive: true,
  role: "USER"
};

describe("account routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates the current account profile", async () => {
    auth.requireCurrentUser.mockResolvedValue(currentUser);
    account.updateAccountProfile.mockResolvedValue({
      ...currentUser,
      displayName: "SJQ"
    });

    const response = await PATCH_PROFILE(
      new Request("http://localhost/api/account/profile", {
        body: JSON.stringify({
          displayName: "SJQ"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      })
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(account.updateAccountProfile).toHaveBeenCalledWith("user-1", {
      displayName: "SJQ"
    });
    expect(payload.user.displayName).toBe("SJQ");
  });

  it("uploads an avatar file with the account profile", async () => {
    const formData = new FormData();
    const avatarFile = new File(["avatar"], "avatar.png", {
      type: "image/png"
    });

    auth.requireCurrentUser.mockResolvedValue(currentUser);
    avatarStorage.saveAvatarFile.mockResolvedValue(
      "/uploads/avatars/user-1-avatar.png"
    );
    account.updateAccountProfile.mockResolvedValue({
      ...currentUser,
      avatarUrl: "/uploads/avatars/user-1-avatar.png",
      displayName: "SJQ"
    });
    formData.set("displayName", "SJQ");
    formData.set("avatar", avatarFile);

    const request = new Request("http://localhost/api/account/profile", {
      headers: {
        "Content-Type": "multipart/form-data"
      },
      method: "PATCH"
    });
    Object.defineProperty(request, "formData", {
      value: vi.fn(async () => formData)
    });

    const response = await PATCH_PROFILE(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(avatarStorage.saveAvatarFile).toHaveBeenCalledWith(
      "user-1",
      avatarFile
    );
    expect(account.updateAccountProfile).toHaveBeenCalledWith("user-1", {
      avatarUrl: "/uploads/avatars/user-1-avatar.png",
      displayName: "SJQ"
    });
    expect(avatarStorage.deleteStoredAvatar).toHaveBeenCalledWith(
      "/uploads/avatars/old-avatar.png"
    );
    expect(payload.user.avatarUrl).toBe("/uploads/avatars/user-1-avatar.png");
  });

  it("maps invalid current passwords to invalid credentials", async () => {
    auth.requireCurrentUser.mockResolvedValue(currentUser);
    account.updateAccountPassword.mockRejectedValue(
      new account.InvalidCurrentPasswordError()
    );

    const response = await PATCH_PASSWORD(
      new Request("http://localhost/api/account/password", {
        body: JSON.stringify({
          currentPassword: "wrong-password",
          newPassword: "new-password"
        }),
        method: "PATCH"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("INVALID_CREDENTIALS");
  });
});
