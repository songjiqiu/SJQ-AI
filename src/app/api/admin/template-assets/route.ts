import { NextResponse } from "next/server";

export function GET() {
  return deprecatedTemplateAssetsResponse();
}

export function POST() {
  return deprecatedTemplateAssetsResponse();
}

function deprecatedTemplateAssetsResponse() {
  return NextResponse.json(
    {
      error: "TEMPLATE_ASSETS_API_DEPRECATED",
      details: {
        message:
          "Template asset APIs were split. Use /api/admin/template-icons, /api/admin/template-shapes, /api/admin/template-lines, /api/admin/template-text-styles, /api/admin/template-containers, or /api/admin/template-navigation."
      }
    },
    {
      status: 410
    }
  );
}
