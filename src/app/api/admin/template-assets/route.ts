import { NextResponse } from "next/server";

import {
  templateElementAssetCreateSchema,
  templateElementAssetListQuerySchema
} from "@/lib/admin/template-assets/schemas";
import {
  createTemplateElementAsset,
  listTemplateElementAssets
} from "@/lib/admin/template-assets/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    await requireAdminUser();

    const url = new URL(request.url);
    const query = templateElementAssetListQuerySchema.parse({
      backgroundMode: url.searchParams.get("backgroundMode") ?? undefined,
      includeDisabled: url.searchParams.get("includeDisabled") ?? undefined,
      includeUnapproved: url.searchParams.get("includeUnapproved") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
      pageType: url.searchParams.get("pageType") ?? undefined,
      primaryCategory: url.searchParams.get("primaryCategory") ?? undefined,
      query: url.searchParams.get("query") ?? undefined,
      reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
      secondaryCategory: url.searchParams.get("secondaryCategory") ?? undefined,
      setKey: url.searchParams.get("setKey") ?? undefined,
      setKind: url.searchParams.get("setKind") ?? undefined,
      styleTag: url.searchParams.get("styleTag") ?? undefined,
      variantKey: url.searchParams.get("variantKey") ?? undefined
    });

    return NextResponse.json({
      assets: await listTemplateElementAssets({
        backgroundMode: query.backgroundMode,
        includeDisabled: query.includeDisabled,
        includeUnapproved: query.includeUnapproved,
        kind: query.kind,
        pageType: query.pageType,
        primaryCategory: query.primaryCategory,
        query: query.query,
        reviewStatus: query.reviewStatus,
        secondaryCategory: query.secondaryCategory,
        setKey: query.setKey,
        setKind: query.setKind,
        styleTag: query.styleTag,
        variantKey: query.variantKey
      })
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser();

    const input = templateElementAssetCreateSchema.parse(await request.json());

    return NextResponse.json(
      {
        asset: await createTemplateElementAsset(input)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
