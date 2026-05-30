import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { handleApiError } from "@/lib/api/responses";
import { getUserDefaultAiEnv } from "@/lib/ai-config/service";
import { analyzeDeck } from "@/lib/ai-deck/analyzer";
import { requireCurrentUser, UnauthorizedError } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const payload = await request.json();
    const userAiEnv = await getUserDefaultAiEnv(user.id);
    const result = await analyzeDeck(
      payload,
      userAiEnv
        ? {
            env: userAiEnv
          }
        : undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "请求参数或 AI 返回结构不符合要求。",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    if (error instanceof UnauthorizedError) {
      return handleApiError(error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI 分析失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}
