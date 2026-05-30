import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AvatarUploadValidationError } from "@/lib/account/avatar-storage";
import { AccountDisabledError, ForbiddenError } from "@/lib/auth/access";
import { InvalidCurrentPasswordError } from "@/lib/account/service";
import { NotFoundError } from "@/lib/ai-config/service";
import { UnauthorizedError } from "@/lib/auth/session";
import {
  LastAdminRequiredError,
  SelfAdminChangeBlockedError
} from "@/lib/admin/users";
import { DeckOutlineFileValidationError } from "@/lib/deck-outline/service";
import { DeckProjectNotFoundError } from "@/lib/decks/service";
import { isMissingPrismaStorageError } from "@/lib/db/prisma-errors";

export function apiError(code: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      error: code,
      details
    },
    {
      status
    }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return apiError("UNAUTHORIZED", 401);
  }

  if (error instanceof AccountDisabledError) {
    return apiError("ACCOUNT_DISABLED", 403);
  }

  if (error instanceof ForbiddenError) {
    return apiError("FORBIDDEN", 403);
  }

  if (error instanceof InvalidCurrentPasswordError) {
    return apiError("INVALID_CREDENTIALS", 401);
  }

  if (error instanceof LastAdminRequiredError) {
    return apiError("LAST_ADMIN_REQUIRED", 409);
  }

  if (error instanceof SelfAdminChangeBlockedError) {
    return apiError("SELF_ADMIN_CHANGE_BLOCKED", 409);
  }

  if (error instanceof NotFoundError) {
    return apiError("NOT_FOUND", 404);
  }

  if (error instanceof DeckProjectNotFoundError) {
    return apiError("NOT_FOUND", 404);
  }

  if (error instanceof Error && error.name === "ProviderModelsFetchError") {
    const details =
      typeof error === "object" && "details" in error ? error.details : undefined;

    return apiError("PROVIDER_MODELS_FETCH_FAILED", 502, details);
  }

  if (error instanceof AvatarUploadValidationError) {
    return apiError("VALIDATION_FAILED", 400, error.details);
  }

  if (error instanceof DeckOutlineFileValidationError) {
    return apiError("VALIDATION_FAILED", 400, error.details);
  }

  if (error instanceof ZodError) {
    return apiError("VALIDATION_FAILED", 400, error.issues);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return apiError("DUPLICATE_RECORD", 409, error.meta);
  }

  if (isMissingPrismaStorageError(error)) {
    return apiError("DATABASE_MIGRATION_REQUIRED", 503);
  }

  return apiError(
    error instanceof Error ? error.message : "INTERNAL_ERROR",
    500
  );
}
