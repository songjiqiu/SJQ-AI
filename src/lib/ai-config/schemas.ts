import { z } from "zod";

export const providerInputSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().trim().url().max(2048),
  clearApiKey: z.boolean().optional(),
  isEnabled: z.boolean().default(true),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/)
});

export const modelInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  isDefault: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  modelId: z.string().trim().min(1).max(160),
  providerId: z.string().min(1),
  temperature: z.coerce.number().min(0).max(2).default(0.7)
});

export const imageModelInputSchema = modelInputSchema;
export const embeddingModelInputSchema = modelInputSchema;

export type ProviderInput = z.infer<typeof providerInputSchema>;
export type ModelInput = z.infer<typeof modelInputSchema>;
export type ImageModelInput = z.infer<typeof imageModelInputSchema>;
export type EmbeddingModelInput = z.infer<typeof embeddingModelInputSchema>;
