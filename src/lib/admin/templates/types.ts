import type {
  PptTemplateCategoryId
} from "@/lib/admin/templates/categories";
import type { SlideCompositionPlan } from "@/lib/ai-deck/schema";

export type PptTemplateDto = {
  category: PptTemplateCategoryId;
  compatibilityWarning?: string;
  createdAt: string;
  customCategoryKey: string | null;
  customCategoryName: string | null;
  description: string | null;
  id: string;
  isEnabled: boolean;
  name: string;
  slide: SlideCompositionPlan;
  sortOrder: number;
  tags: string[];
  updatedAt: string;
};
