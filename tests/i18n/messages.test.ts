import { describe, expect, it } from "vitest";

import enMessages from "../../messages/en-US.json";
import zhMessages from "../../messages/zh-CN.json";

function collectPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return [
      prefix,
      ...value.flatMap((item, index) =>
        collectPaths(item, `${prefix}[${index}]`)
      )
    ].filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      collectPaths(child, prefix ? `${prefix}.${key}` : key)
    );
  }

  return prefix ? [prefix] : [];
}

describe("i18n messages", () => {
  it("keeps zh-CN and en-US message keys aligned", () => {
    expect(collectPaths(enMessages).sort()).toEqual(
      collectPaths(zhMessages).sort()
    );
  });
});
