import { describe, expect, it } from "vitest";

import {
  embeddingModelInputSchema,
  imageModelInputSchema,
  modelInputSchema,
  providerInputSchema
} from "@/lib/ai-config/schemas";

describe("AI configuration schemas", () => {
  it("accepts OpenAI-compatible provider configuration", () => {
    const provider = providerInputSchema.parse({
      baseUrl: "https://api.deepseek.com",
      isEnabled: true,
      name: "deepseek",
      slug: "DeepSeek"
    });

    expect(provider.slug).toBe("deepseek");
  });

  it("rejects invalid provider slugs and URLs", () => {
    expect(() =>
      providerInputSchema.parse({
        baseUrl: "not-a-url",
        isEnabled: true,
        name: "Bad Provider",
        slug: "bad provider"
      })
    ).toThrow();
  });

  it("coerces model temperature and validates bounds", () => {
    const model = modelInputSchema.parse({
      displayName: "deepseek-v4-flash",
      isDefault: true,
      isEnabled: true,
      modelId: "deepseek-v4-flash",
      providerId: "provider-1",
      temperature: "1.3"
    });

    expect(model.temperature).toBe(1.3);
    expect(() =>
      modelInputSchema.parse({
        displayName: "too-hot",
        modelId: "too-hot",
        providerId: "provider-1",
        temperature: "4"
      })
    ).toThrow();
  });

  it("accepts image model configuration with the shared model fields", () => {
    const model = imageModelInputSchema.parse({
      displayName: "gpt-image-2",
      isDefault: true,
      modelId: "gpt-image-2",
      providerId: "provider-1",
      temperature: "0.8"
    });

    expect(model.modelId).toBe("gpt-image-2");
    expect(model.isDefault).toBe(true);
    expect(model.temperature).toBe(0.8);
  });

  it("accepts embedding model configuration with the shared model fields", () => {
    const model = embeddingModelInputSchema.parse({
      displayName: "text-embedding-3-small",
      modelId: "text-embedding-3-small",
      providerId: "provider-1"
    });

    expect(model.isEnabled).toBe(true);
    expect(model.temperature).toBe(0.7);
  });
});
