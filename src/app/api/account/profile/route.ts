import { NextResponse } from "next/server";

import {
  deleteStoredAvatar,
  saveAvatarFile
} from "@/lib/account/avatar-storage";
import { accountProfileUpdateSchema } from "@/lib/account/schemas";
import { updateAccountProfile } from "@/lib/account/service";
import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";

export async function PATCH(request: Request) {
  let savedAvatarUrl: string | undefined;

  try {
    const currentUser = await requireCurrentUser();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const baseInput = accountProfileUpdateSchema.parse({
        displayName: formData.get("displayName")
      });
      const avatarEntry = formData.get("avatar");

      if (avatarEntry instanceof File && avatarEntry.size > 0) {
        savedAvatarUrl = await saveAvatarFile(currentUser.id, avatarEntry);
      }

      const user = await updateAccountProfile(currentUser.id, {
        ...baseInput,
        avatarUrl: savedAvatarUrl
      });

      if (savedAvatarUrl) {
        await deleteStoredAvatar(currentUser.avatarUrl);
      }

      return NextResponse.json({
        user
      });
    }

    const input = accountProfileUpdateSchema.parse(await request.json());

    return NextResponse.json({
      user: await updateAccountProfile(currentUser.id, input)
    });
  } catch (error) {
    if (savedAvatarUrl) {
      await deleteStoredAvatar(savedAvatarUrl);
    }

    return handleApiError(error);
  }
}
