import { pptSlotTemplateJsonSchema } from "@/lib/admin/ppt-to-slot/schemas";
import type { PptSlotTemplateJson } from "@/lib/admin/ppt-to-slot/types";

export function validatePptSlotTemplateJson(template: PptSlotTemplateJson) {
  return pptSlotTemplateJsonSchema.parse(template);
}

export function stringifyArtifactJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
