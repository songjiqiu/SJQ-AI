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

export type TemplateIconAssetDetail = {
  cornerRadius: number | null;
  fillMode: string | null;
  iconName: string;
  iconStyle: string;
  strokeColor: string | null;
  strokeWidth: number | null;
};

export type TemplateShapeAssetDetail = {
  cornerRadius: number | null;
  fillColor: string | null;
  opacity: number | null;
  shadow: boolean;
  shapeType: string;
  strokeColor: string | null;
  strokeWidth: number | null;
};

export type TemplateLineAssetDetail = {
  cap: string;
  connectorType: string;
  dash: string;
  direction: string;
  endArrowType: string;
  startArrowType: string;
  strokeColor: string | null;
  strokeWidth: number | null;
};

export type TemplateTextStyleAssetDetail = {
  color: string | null;
  fontFamily: string | null;
  fontSize: number | null;
  fontWeight: number | null;
  letterSpacing: number | null;
  lineHeight: number | null;
  maxLines: number | null;
  textRole: string;
};

export type TemplateContainerAssetDetail = {
  allowedContentTypes: string[];
  autoLayout: boolean;
  containerRole: string;
  fillColor: string | null;
  gap: number | null;
  padding: number | null;
  recommendedHeight: number | null;
  recommendedWidth: number | null;
  strokeColor: string | null;
  strokeWidth: number | null;
};

export type TemplateNavigationAssetDetail = {
  activeColor: string | null;
  displayMode: string;
  fixedPosition: string;
  inactiveColor: string | null;
  navigationRole: string;
  showOnCover: boolean;
  showOnEnding: boolean;
};

export type TemplateAssetDetail =
  | TemplateIconAssetDetail
  | TemplateShapeAssetDetail
  | TemplateLineAssetDetail
  | TemplateTextStyleAssetDetail
  | TemplateContainerAssetDetail
  | TemplateNavigationAssetDetail;

export type TemplateAssetDto = {
  aiModifyPermissions: TemplateAssetModifyPermissions;
  backgroundModes: string[];
  colorTags: string[];
  createdAt: string;
  description: string | null;
  detail: TemplateAssetDetail;
  id: string;
  isEnabled: boolean;
  keywords: string[];
  kind: TemplateElementAssetKind;
  name: string;
  pageTypes: string[];
  preview: Record<string, unknown>;
  primaryCategory: string | null;
  resource: Record<string, unknown>;
  reviewStatus: TemplateAssetReviewStatus;
  secondaryCategory: string | null;
  semanticTags: string[];
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

export type TemplateAssetAiResult = TemplateAssetDto & {
  matchScore: number;
  usageSuggestion: string;
};

export type TemplateElementAssetDto = TemplateAssetDto;
export type TemplateElementAssetAiResult = TemplateAssetAiResult;
