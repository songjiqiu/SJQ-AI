import { z } from "zod";

export const adminUserUpdateSchema = z
  .object({
    isActive: z.boolean().optional(),
    role: z.enum(["USER", "ADMIN"]).optional()
  })
  .refine((value) => value.isActive !== undefined || value.role !== undefined, {
    message: "At least one user field must be provided."
  });

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
