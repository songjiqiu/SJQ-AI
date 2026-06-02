import type {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind
} from "@prisma/client";

export type TemplateAssetModifyPermissions = {
  allowAutoLayout: boolean;
  allowMove: boolean;
  allowRecolor: boolean;
  allowResize: boolean;
  allowStretch: boolean;
  allowTextShrink: boolean;
};

export type TemplateElementAssetDto = {
  aiModifyPermissions: TemplateAssetModifyPermissions;
  backgroundModes: string[];
  colorTags: string[];
  createdAt: string;
  description: string | null;
  id: string;
  isEnabled: boolean;
  kind: TemplateElementAssetKind;
  keywords: string[];
  name: string;
  pageTypes: string[];
  preview: Record<string, unknown>;
  primaryCategory: string | null;
  resource: Record<string, unknown>;
  reviewStatus: TemplateAssetReviewStatus;
  semanticTags: string[];
  secondaryCategory: string | null;
  setKey: string;
  setKind: TemplateAssetSetKind;
  setName: string;
  sortOrder: number;
  source: TemplateAssetSource;
  style: Record<string, unknown>;
  styleTags: string[];
  synonyms: string[];
  tags: string[];
  updatedAt: string;
  usageScenarios: string[];
  variantKey: string | null;
};

export type TemplateElementAssetAiResult = TemplateElementAssetDto & {
  matchScore: number;
  usageSuggestion: string;
};
