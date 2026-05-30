import type { UserRole } from "@prisma/client";

export type AdminUserDto = {
  counts: {
    models: number;
    providers: number;
    sessions: number;
  };
  createdAt: string;
  email: string;
  id: string;
  isActive: boolean;
  role: UserRole;
  updatedAt: string;
};
