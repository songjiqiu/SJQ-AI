import { TemplateElementAssetKind } from "@prisma/client";

import { createTemplateAssetAiSearchHandler } from "@/lib/admin/template-assets/api-routes";

export const POST = createTemplateAssetAiSearchHandler(
  TemplateElementAssetKind.ICON
);
