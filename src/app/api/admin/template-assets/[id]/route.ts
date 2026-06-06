import { NextResponse } from "next/server";

export function DELETE() {
  return deprecatedTemplateAssetsResponse();
}

export function GET() {
  return deprecatedTemplateAssetsResponse();
}

export function PATCH() {
  return deprecatedTemplateAssetsResponse();
}

function deprecatedTemplateAssetsResponse() {
  return NextResponse.json(
    {
      error: "TEMPLATE_ASSETS_API_DEPRECATED",
      details: {
        message:
          "Template asset APIs were split into dedicated icon, shape, line, text-style, container, and navigation endpoints."
      }
    },
    {
      status: 410
    }
  );
}
