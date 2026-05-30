export type AiProviderDto = {
  baseUrl: string;
  createdAt: string;
  hasApiKey: boolean;
  id: string;
  isEnabled: boolean;
  modelCount: number;
  name: string;
  slug: string;
  updatedAt: string;
};

export type AvailableProviderModelDto = {
  createdAt?: string;
  displayName: string;
  id: string;
  ownedBy?: string;
};

export type AiModelKindDto = "LLM" | "IMAGE" | "EMBEDDING";

export type AiModelConfigDto = {
  createdAt: string;
  displayName: string;
  id: string;
  isDefault: boolean;
  isEnabled: boolean;
  kind: AiModelKindDto;
  modelId: string;
  providerId: string;
  providerName: string;
  providerSlug: string;
  temperature: number;
  updatedAt: string;
};

export type LlmModelDto = AiModelConfigDto & {
  kind: "LLM";
};

export type ImageModelDto = AiModelConfigDto & {
  kind: "IMAGE";
};

export type EmbeddingModelDto = AiModelConfigDto & {
  kind: "EMBEDDING";
};
