import { z } from "zod";

const avatarUploadPathPattern =
  /^\/uploads\/avatars\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/i;

const optionalAvatarUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .optional();

export const accountProfileUpdateSchema = z.object({
  avatarUrl: optionalAvatarUrlSchema.refine(
    (value) =>
      value === undefined ||
      value === "" ||
      avatarUploadPathPattern.test(value) ||
      z.string().url().safeParse(value).success,
    "avatarUrl.invalid"
  ),
  displayName: z.string().trim().min(1).max(80)
});

export const accountPasswordUpdateSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128)
});

export type AccountProfileUpdateInput = z.infer<
  typeof accountProfileUpdateSchema
>;
export type AccountPasswordUpdateInput = z.infer<
  typeof accountPasswordUpdateSchema
>;
