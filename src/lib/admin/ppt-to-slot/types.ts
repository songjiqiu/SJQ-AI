export const pptToSlotArtifactKinds = [
  "template",
  "rawLayers",
  "layoutCandidates",
  "overlay",
  "reviewReport"
] as const;

export const pptSlotTemplateReviewStatuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED"
] as const;

export type PptToSlotArtifactKind = (typeof pptToSlotArtifactKinds)[number];
export type PptSlotTemplateReviewStatus =
  (typeof pptSlotTemplateReviewStatuses)[number];

export type SlotFrame = {
  h: number;
  w: number;
  x: number;
  y: number;
};

export type SlotCanvas = SlotFrame & {
  unit: "inch";
};

export type PptLayerType =
  | "text"
  | "shape"
  | "image"
  | "chart"
  | "table"
  | "group"
  | "line"
  | "icon"
  | "unknown";

export type PptLayerStyle = {
  bold?: boolean;
  color?: string | null;
  fill?: string | null;
  fontFace?: string | null;
  fontSize?: number | null;
  line?: string | null;
};

export type PptRawLayer = {
  frame: SlotFrame;
  id: string;
  name: string;
  style: PptLayerStyle;
  text?: string;
  type: PptLayerType;
  visible: boolean;
  zIndex: number;
};

export type PptRawSlide = {
  canvas: SlotCanvas;
  layers: PptRawLayer[];
  slideIndex: number;
};

export type PptRegionCandidate = {
  frame: SlotFrame;
  layout?: {
    count?: number;
    gap?: number;
    type: string;
  };
  possibleRoles: string[];
  regionId: string;
  sourceLayerIds: string[];
};

export type PptLayoutAnalysis = {
  alignmentLines: {
    x: number[];
    y: number[];
  };
  layoutPattern: string;
  pageTypes: string[];
  regions: PptRegionCandidate[];
  safeArea: SlotFrame;
};

export type PptSlotTemplateSlot = {
  constraints: Record<string, unknown>;
  frame: SlotFrame;
  id: string;
  layout?: Record<string, unknown>;
  placeholder?: string;
  required: boolean;
  roles: string[];
};

export type PptSlotTemplateJson = {
  alignmentLines: {
    x: number[];
    y: number[];
  };
  canvas: SlotCanvas;
  id: string;
  layoutPattern: string;
  name: string;
  pageTypes: string[];
  rules: Record<string, unknown>;
  safeArea: SlotFrame;
  slots: Record<string, PptSlotTemplateSlot>;
  source: {
    file: string;
    slideIndex: number;
  };
  styleTokens: Record<string, unknown>;
  usage: {
    notSuitableFor: string[];
    suitableFor: string[];
  };
  version: "1.0.0";
};

export type PptToSlotArtifactPaths = Record<PptToSlotArtifactKind, string>;

export type PptSlotTemplateDto = {
  alignmentLines: PptSlotTemplateJson["alignmentLines"];
  artifactPaths: PptToSlotArtifactPaths;
  canvas: SlotCanvas;
  createdAt: string;
  description: string | null;
  id: string;
  isEnabled: boolean;
  layoutPattern: string;
  name: string;
  overlayPath: string | null;
  pageTypes: string[];
  reviewNotes: string | null;
  reviewStatus: PptSlotTemplateReviewStatus;
  rules: Record<string, unknown>;
  safeArea: SlotFrame;
  slots: Record<string, PptSlotTemplateSlot>;
  sourceFile: string;
  sourceSlideIndex: number;
  styleTokens: Record<string, unknown>;
  updatedAt: string;
  usage: PptSlotTemplateJson["usage"];
};

export type PptToSlotJobResult = {
  jobId: string;
  templates: PptSlotTemplateDto[];
  warnings: string[];
};
