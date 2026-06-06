import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    {
      error: "TEMPLATE_ASSETS_API_DEPRECATED",
      details: {
        message:
          "Use the type-specific ai-search endpoint such as /api/admin/template-icons/ai-search."
      }
    },
    {
      status: 410
    }
  );
}
