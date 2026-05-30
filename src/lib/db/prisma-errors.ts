function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isMissingPrismaModelStorageError(
  error: unknown,
  modelName: string
) {
  if (!isMissingPrismaStorageError(error)) {
    return false;
  }

  return deepTextIncludes(error, modelName);
}

export function isMissingPrismaStorageError(error: unknown) {
  if (!isRecord(error)) {
    return false;
  }

  return error.code === "P2021" || error.code === "P2022";
}

function deepTextIncludes(value: unknown, pattern: string): boolean {
  if (typeof value === "string") {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }

  if (value instanceof Error) {
    return (
      value.message.toLowerCase().includes(pattern.toLowerCase()) ||
      deepTextIncludes(value.cause, pattern)
    );
  }

  if (Array.isArray(value)) {
    return value.some((item) => deepTextIncludes(item, pattern));
  }

  if (isRecord(value)) {
    return Object.values(value).some((item) => deepTextIncludes(item, pattern));
  }

  return false;
}
