import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AvatarUploadValidationError } from "@/lib/account/avatar-storage";
import { AccountDisabledError, ForbiddenError } from "@/lib/auth/access";
import { InvalidCurrentPasswordError } from "@/lib/account/service";
import { NotFoundError } from "@/lib/ai-config/service";
import { AiJsonError } from "@/lib/ai-deck/openai-json";
import { UnauthorizedError } from "@/lib/auth/session";
import {
  LastAdminRequiredError,
  SelfAdminChangeBlockedError
} from "@/lib/admin/users";
import { DeckOutlineFileValidationError } from "@/lib/deck-outline/service";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";
import { DeckProjectNotFoundError } from "@/lib/decks/service";
import { isMissingPrismaStorageError } from "@/lib/db/prisma-errors";

export function apiError(code: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      error: code,
      details: sanitizeApiErrorDetails(details)
    },
    {
      status
    }
  );
}

export function sanitizeApiErrorDetails(details: unknown): unknown {
  return sanitizeApiErrorValue(details, new WeakSet<object>());
}

function sanitizeApiErrorValue(
  value: unknown,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") {
    return sanitizeApiErrorString(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeApiErrorValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sanitizeApiErrorObjectEntry(key, item, seen)
    ])
  );
}

function sanitizeApiErrorObjectEntry(
  key: string,
  value: unknown,
  seen: WeakSet<object>
) {
  if (isDatabaseUrlKey(key)) {
    return typeof value === "string"
      ? sanitizeDatabaseUrl(value)
      : "[REDACTED]";
  }

  if (isSensitiveKey(key)) {
    return "[REDACTED]";
  }

  return sanitizeApiErrorValue(value, seen);
}

function isDatabaseUrlKey(key: string) {
  return key.toLowerCase().replace(/[_-]/g, "") === "databaseurl";
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");

  return (
    normalized.includes("apikey") ||
    normalized.includes("authorization") ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token")
  );
}

function sanitizeApiErrorString(value: string) {
  return sanitizeDatabaseUrl(value)
    .replace(
      /(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;]+/gi,
      "$1$2[REDACTED]"
    )
    .replace(/(api[-_]?key\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(password\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");
}

function sanitizeDatabaseUrl(value: string) {
  return value.replace(
    /((?:mysql|mariadb|postgres|postgresql):\/\/[^:\s/?#]+:)[^@\s/?#]+(@)/gi,
    "$1***$2"
  );
}

function formatUnknownApiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

  if (error instanceof ActiveGenerationExistsError) {
    return apiError("ACTIVE_GENERATION_EXISTS", 409);
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

  if (error instanceof AiJsonError) {
    return apiError("AI_JSON_GENERATION_FAILED", 502, error.details);
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

  return apiError("INTERNAL_ERROR", 500, {
    message: formatUnknownApiErrorMessage(error)
  });
}
