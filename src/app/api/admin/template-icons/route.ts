import { TemplateElementAssetKind } from "@prisma/client";

import { createTemplateAssetCollectionHandlers } from "@/lib/admin/template-assets/api-routes";

const handlers = createTemplateAssetCollectionHandlers(
  TemplateElementAssetKind.ICON
);

export const GET = handlers.GET;
export const POST = handlers.POST;
