"use client";

type WorkbenchApiErrorPayload = {
  details?: unknown;
  error?: string;
};

export class WorkbenchApiError extends Error {
  code?: string;
  debugDetails: WorkbenchFailureDetails;
  details?: unknown;

  constructor({
    code,
    details,
    message
  }: {
    code?: string;
    details?: unknown;
    message: string;
  }) {
    super(message);
    this.name = "WorkbenchApiError";
    this.code = code;
    this.details = details;
    this.debugDetails = {
      ...(code ? { error: code } : {}),
      message,
      ...(details !== undefined ? { details } : {})
    };
  }
}

type WorkbenchFailureDetails = {
  details?: unknown;
  error?: string;
  message: string;
};

type WorkbenchErrorTranslationKey =
  | "errors.aiJsonGenerationFailed"
  | "errors.databaseMigrationRequired"
  | "errors.failureDetails"
  | "errors.activeGenerationExists"
  | "errors.unauthorized"
  | "errors.validation"
  | "toast.failed";

type WorkbenchErrorTranslator = (key: WorkbenchErrorTranslationKey) => string;

export function getWorkbenchApiErrorMessage(
  code: string | undefined,
  t: WorkbenchErrorTranslator
) {
  return getLocalizedWorkbenchApiErrorMessage(code, t) ?? t("toast.failed");
}

export function createWorkbenchApiError(
  payload: WorkbenchApiErrorPayload,
  t: WorkbenchErrorTranslator
) {
  return new WorkbenchApiError({
    code: payload.error,
    details: payload.details,
    message:
      getLocalizedWorkbenchApiErrorMessage(payload.error, t) ??
      getDetailsMessage(payload.details) ??
      t("toast.failed")
  });
}

export async function deleteWorkbenchResource(
  url: string,
  t: WorkbenchErrorTranslator,
  fallbackMessage: string
) {
  const response = await fetch(url, {
    method: "DELETE"
  });
  const payload = (await response.json().catch(() => ({}))) as WorkbenchApiErrorPayload;

  if (!response.ok) {
    const error = createWorkbenchApiError(payload, t);

    throw new Error(error.message || fallbackMessage);
  }

  return payload;
}

function getLocalizedWorkbenchApiErrorMessage(
  code: string | undefined,
  t: WorkbenchErrorTranslator
) {
  if (code === "AI_JSON_GENERATION_FAILED") {
    return t("errors.aiJsonGenerationFailed");
  }

  if (code === "VALIDATION_FAILED") {
    return t("errors.validation");
  }

  if (code === "DATABASE_MIGRATION_REQUIRED") {
    return t("errors.databaseMigrationRequired");
  }

  if (code === "UNAUTHORIZED") {
    return t("errors.unauthorized");
  }

  if (code === "ACTIVE_GENERATION_EXISTS") {
    return t("errors.activeGenerationExists");
  }

  return undefined;
}

function getDetailsMessage(details: unknown) {
  if (
    typeof details === "object" &&
    details !== null &&
    "message" in details &&
    typeof details.message === "string"
  ) {
    return details.message;
  }

  return undefined;
}
