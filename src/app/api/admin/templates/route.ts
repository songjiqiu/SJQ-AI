import { NextResponse } from "next/server";

import {
  pptTemplateCreateSchema,
  pptTemplateListQuerySchema
} from "@/lib/admin/templates/schemas";
import {
  createPptTemplate,
  listPptTemplates
} from "@/lib/admin/templates/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    await requireAdminUser();

    const url = new URL(request.url);
    const query = pptTemplateListQuerySchema.parse({
      category: url.searchParams.get("category") ?? undefined,
      includeDisabled: url.searchParams.get("includeDisabled") ?? undefined
    });

    return NextResponse.json({
      templates: await listPptTemplates({
        category: query.category,
        includeDisabled: query.includeDisabled
      })
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser();

    const input = pptTemplateCreateSchema.parse(await request.json());

    return NextResponse.json(
      {
        template: await createPptTemplate(input)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
