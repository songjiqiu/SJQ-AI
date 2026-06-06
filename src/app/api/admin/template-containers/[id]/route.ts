import { TemplateElementAssetKind } from "@prisma/client";

import { createTemplateAssetItemHandlers } from "@/lib/admin/template-assets/api-routes";

const handlers = createTemplateAssetItemHandlers(
  TemplateElementAssetKind.CONTAINER
);

export const DELETE = handlers.DELETE;
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
