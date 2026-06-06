import { NextResponse } from "next/server";
import type { TemplateElementAssetKind } from "@prisma/client";

import {
  templateElementAssetAiSearchSchema,
  templateElementAssetCreateSchema,
  templateElementAssetListQuerySchema,
  templateElementAssetUpdateSchema
} from "@/lib/admin/template-assets/schemas";
import {
  createTemplateAssetByKind,
  deleteTemplateAssetByKind,
  getTemplateAssetByKind,
  listTemplateAssetsByKind,
  searchTemplateAssetsForAiByKind,
  updateTemplateAssetByKind
} from "@/lib/admin/template-assets/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export function createTemplateAssetCollectionHandlers(
  kind: TemplateElementAssetKind
) {
  return {
    async GET(request: Request) {
      try {
        await requireAdminUser();

        const url = new URL(request.url);
        const query = templateElementAssetListQuerySchema.parse({
          backgroundMode: url.searchParams.get("backgroundMode") ?? undefined,
          includeDisabled: url.searchParams.get("includeDisabled") ?? undefined,
          includeUnapproved:
            url.searchParams.get("includeUnapproved") ?? undefined,
          pageType: url.searchParams.get("pageType") ?? undefined,
          primaryCategory: url.searchParams.get("primaryCategory") ?? undefined,
          query: url.searchParams.get("query") ?? undefined,
          reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
          secondaryCategory:
            url.searchParams.get("secondaryCategory") ?? undefined,
          setKey: url.searchParams.get("setKey") ?? undefined,
          setKind: url.searchParams.get("setKind") ?? undefined,
          styleTag: url.searchParams.get("styleTag") ?? undefined,
          variantKey: url.searchParams.get("variantKey") ?? undefined
        });

        return NextResponse.json({
          assets: await listTemplateAssetsByKind(kind, query)
        });
      } catch (error) {
        return handleApiError(error);
      }
    },
    async POST(request: Request) {
      try {
        await requireAdminUser();

        const input = templateElementAssetCreateSchema.parse({
          ...(await request.json()),
          kind
        });

        return NextResponse.json(
          {
            asset: await createTemplateAssetByKind(kind, input)
          },
          {
            status: 201
          }
        );
      } catch (error) {
        return handleApiError(error);
      }
    }
  };
}

export function createTemplateAssetItemHandlers(kind: TemplateElementAssetKind) {
  return {
    async DELETE(
      _request: Request,
      context: { params: Promise<{ id: string }> }
    ) {
      try {
        await requireAdminUser();
        const { id } = await context.params;

        await deleteTemplateAssetByKind(kind, id);

        return new NextResponse(null, {
          status: 204
        });
      } catch (error) {
        return handleApiError(error);
      }
    },
    async GET(
      _request: Request,
      context: { params: Promise<{ id: string }> }
    ) {
      try {
        await requireAdminUser();
        const { id } = await context.params;

        return NextResponse.json({
          asset: await getTemplateAssetByKind(kind, id)
        });
      } catch (error) {
        return handleApiError(error);
      }
    },
    async PATCH(
      request: Request,
      context: { params: Promise<{ id: string }> }
    ) {
      try {
        await requireAdminUser();
        const { id } = await context.params;
        const input = templateElementAssetUpdateSchema.parse(await request.json());

        return NextResponse.json({
          asset: await updateTemplateAssetByKind(kind, id, input)
        });
      } catch (error) {
        return handleApiError(error);
      }
    }
  };
}

export function createTemplateAssetAiSearchHandler(
  kind: TemplateElementAssetKind
) {
  return async function POST(request: Request) {
    try {
      await requireAdminUser();

      const input = templateElementAssetAiSearchSchema.parse(await request.json());

      return NextResponse.json({
        assets: await searchTemplateAssetsForAiByKind(kind, input)
      });
    } catch (error) {
      return handleApiError(error);
    }
  };
}
