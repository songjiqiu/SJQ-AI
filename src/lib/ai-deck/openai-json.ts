import { z, type ZodType } from "zod";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ResponseFormatMode = "json_schema" | "json_object" | "plain";
type AiJsonAttemptStage = "request" | "response" | "parse" | "validation";

export type AiJsonAttemptDiagnostic = {
  error: string;
  mode: ResponseFormatMode;
  responseSnippet?: string;
  stage: AiJsonAttemptStage;
  zodIssues?: Array<{
    code: string;
    message: string;
    path: Array<string | number>;
  }>;
};

export type AiJsonErrorDetails = {
  attempts: AiJsonAttemptDiagnostic[];
  message: string;
  model: string;
  schemaName: string;
};

export type JsonChatClient = {
  chat: {
    completions: {
      create: (payload: Record<string, unknown>) => Promise<{
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      }>;
    };
  };
};

export class AiJsonError extends Error {
  details?: AiJsonErrorDetails;

  constructor(message: string, details?: AiJsonErrorDetails) {
    super(message);
    this.name = "AiJsonError";
    this.details = details;
  }
}

class JsonCompletionError extends Error {
  responseContent?: string;
  responseSnippet?: string;
  stage: AiJsonAttemptStage;

  constructor({
    message,
    responseContent,
    responseSnippet,
    stage
  }: {
    message: string;
    responseContent?: string;
    responseSnippet?: string;
    stage: AiJsonAttemptStage;
  }) {
    super(message);
    this.name = "JsonCompletionError";
    this.responseContent = responseContent;
    this.responseSnippet = responseSnippet;
    this.stage = stage;
  }
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const responseSnippetMaxLength = 2000;
const responseRepairContentMaxLength = 60000;

function toResponseSnippet(content: string) {
  return content.trim().slice(0, responseSnippetMaxLength);
}

function toResponseRepairContent(content: string) {
  return content.trim().slice(0, responseRepairContentMaxLength);
}

function formatZodIssues(error: unknown) {
  if (!(error instanceof z.ZodError)) {
    return undefined;
  }

  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.map((item) =>
      typeof item === "number" ? item : String(item)
    )
  }));
}

function buildAiJsonErrorDetails({
  attempts,
  message,
  model,
  schemaName
}: {
  attempts: AiJsonAttemptDiagnostic[];
  message: string;
  model: string;
  schemaName: string;
}): AiJsonErrorDetails {
  return {
    attempts,
    message,
    model,
    schemaName
  };
}

function isResponseFormatUnavailableError(error: unknown) {
  const message = formatErrorMessage(error).toLowerCase();

  return (
    message.includes("response_format") &&
    (message.includes("unavailable") ||
      message.includes("unsupported") ||
      message.includes("not supported") ||
      message.includes("not support") ||
      message.includes("invalid") ||
      message.includes("unknown") ||
      message.includes("不可用") ||
      message.includes("不支持"))
  );
}

function escapeControlCharactersInJsonStrings(content: string) {
  let escaped = false;
  let inString = false;
  let repaired = "";

  for (const char of content) {
    if (!inString) {
      repaired += char;

      if (char === '"') {
        inString = true;
      }

      continue;
    }

    if (escaped) {
      repaired += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      repaired += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      repaired += char;
      inString = false;
      continue;
    }

    const code = char.charCodeAt(0);

    if (code <= 0x1f) {
      if (char === "\b") {
        repaired += "\\b";
      } else if (char === "\f") {
        repaired += "\\f";
      } else if (char === "\n") {
        repaired += "\\n";
      } else if (char === "\r") {
        repaired += "\\r";
      } else if (char === "\t") {
        repaired += "\\t";
      } else {
        repaired += `\\u${code.toString(16).padStart(4, "0")}`;
      }

      continue;
    }

    repaired += char;
  }

  return repaired;
}

function stripJsonMarkdownFence(content: string) {
  const trimmed = content.trim();
  const match = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/.exec(trimmed);

  return match ? match[1].trim() : trimmed;
}

function isJsonLikeContent(content: string) {
  const trimmed = stripJsonMarkdownFence(content);

  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function parseJsonContent(content: string) {
  const trimmed = stripJsonMarkdownFence(content);

  if (trimmed.startsWith("```")) {
    throw new Error("AI response used Markdown fences instead of pure JSON.");
  }

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error("AI response included non-JSON explanatory text.");
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const repaired = escapeControlCharactersInJsonStrings(trimmed);

    if (repaired !== trimmed) {
      try {
        return JSON.parse(repaired);
      } catch {
        // Keep the original parser message because it points to the model output.
      }
    }

    throw error;
  }
}

async function createJsonCompletion({
  client,
  messages,
  model,
  schema,
  schemaName,
  responseFormatMode,
  temperature
}: {
  client: JsonChatClient;
  messages: ChatMessage[];
  model: string;
  schema: ZodType;
  schemaName: string;
  responseFormatMode: ResponseFormatMode;
  temperature: number;
}) {
  const responseFormat =
    responseFormatMode === "json_schema"
      ? {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema: z.toJSONSchema(schema)
          }
        }
      : responseFormatMode === "json_object"
        ? {
            type: "json_object"
          }
        : undefined;
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature
  };

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  let response: Awaited<
    ReturnType<JsonChatClient["chat"]["completions"]["create"]>
  >;

  try {
    response = await client.chat.completions.create(payload);
  } catch (error) {
    throw new JsonCompletionError({
      message: formatErrorMessage(error),
      stage: "request"
    });
  }

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new JsonCompletionError({
      message: "AI response did not include JSON content.",
      stage: "response"
    });
  }

  try {
    return {
      responseSnippet: toResponseSnippet(content),
      value: parseJsonContent(content)
    };
  } catch (error) {
    throw new JsonCompletionError({
      message: formatErrorMessage(error),
      responseContent: toResponseRepairContent(content),
      responseSnippet: toResponseSnippet(content),
      stage: "parse"
    });
  }
}

export async function generateValidatedJson<T>({
  client,
  messages,
  model,
  normalize,
  retryValidation = true,
  temperature = 0.2,
  schema,
  schemaName
}: {
  client: JsonChatClient;
  messages: ChatMessage[];
  model: string;
  normalize?: (value: unknown) => unknown;
  retryValidation?: boolean;
  temperature?: number;
  schema: ZodType<T>;
  schemaName: string;
}) {
  const attempts: AiJsonAttemptDiagnostic[] = [];
  let firstError: unknown;
  let lastRepairableParseError: JsonCompletionError | undefined;
  let retryError: unknown;
  const schemaInstruction = `目标 JSON Schema（必须完整符合，且不要输出 schema 之外的字段）：\n${JSON.stringify(
    z.toJSONSchema(schema),
    null,
    2
  )}`;

  async function runAttempt({
    attemptMessages,
    responseFormatMode
  }: {
    attemptMessages: ChatMessage[];
    responseFormatMode: ResponseFormatMode;
  }) {
    try {
      const { responseSnippet, value } = await createJsonCompletion({
        client,
        messages: attemptMessages,
        model,
        schema,
        schemaName,
        responseFormatMode,
        temperature
      });

      try {
        return schema.parse(normalize ? normalize(value) : value);
      } catch (error) {
        attempts.push({
          error: formatErrorMessage(error),
          mode: responseFormatMode,
          responseSnippet,
          stage: "validation",
          zodIssues: formatZodIssues(error)
        });

        throw error;
      }
    } catch (error) {
      if (error instanceof JsonCompletionError) {
        attempts.push({
          error: error.message,
          mode: responseFormatMode,
          ...(error.responseSnippet
            ? { responseSnippet: error.responseSnippet }
            : {}),
          stage: error.stage
        });

        if (
          error.stage === "parse" &&
          error.responseContent &&
          isJsonLikeContent(error.responseContent)
        ) {
          lastRepairableParseError = error;
        }
      }

      throw error;
    }
  }

  async function runModelJsonRepairAttempt(parseError: JsonCompletionError) {
    const responseContent = parseError.responseContent;

    if (!responseContent) {
      throw new Error("No JSON repair content available.");
    }

    return runAttempt({
      attemptMessages: [
        {
          role: "system",
          content:
            "你是 JSON 格式修复器。你只修复 JSON 语法和字符串转义，不改写字段含义，不新增解释。"
        },
        {
          role: "user",
          content: `上一轮模型输出看起来像 JSON，但不是合法 JSON。解析错误：${parseError.message}

请基于下面原始输出修复为严格 JSON：
- 只输出 JSON 对象或数组，不要 Markdown，不要代码围栏，不要解释。
- 不要改变字段含义、字段名、页数或内容结构。
- 字符串里的换行、制表符、回车和英文双引号必须使用合法 JSON 转义。
- typographyRules.scale.*.usage 这类用途说明保持单行短句。
- 输出必须完整符合目标 schema。

原始输出：
${responseContent}

${schemaInstruction}`
        }
      ],
      responseFormatMode: "plain"
    });
  }

  function buildError(message: string) {
    return new AiJsonError(
      message,
      buildAiJsonErrorDetails({
        attempts,
        message,
        model,
        schemaName
      })
    );
  }

  try {
    return await runAttempt({
      attemptMessages: messages,
      responseFormatMode: "json_schema"
    });
  } catch (error) {
    firstError = error;
  }

  if (retryValidation) {
    try {
      return await runAttempt({
        attemptMessages: [
          ...messages,
          {
            role: "user",
            content: `上一次输出未通过结构化校验。请修复为一个严格 JSON 对象：不要 Markdown，不要代码围栏，不要解释，不要在 JSON 前后添加任何文字，字段必须完整并符合 schema。所有字符串里的换行、制表符、回车和英文双引号必须使用合法 JSON 转义。

${schemaInstruction}`
          }
        ],
        responseFormatMode: "json_object"
      });
    } catch (error) {
      retryError = error;
    }
  } else {
    retryError = firstError;
  }

  if (
    isResponseFormatUnavailableError(firstError) ||
    isResponseFormatUnavailableError(retryError)
  ) {
    try {
      return await runAttempt({
        attemptMessages: [
          ...messages,
          {
            role: "user",
            content: `当前模型服务可能不支持 response_format。请仍然只输出一个严格 JSON 对象：不要 Markdown，不要代码围栏，不要解释，不要在 JSON 前后添加任何文字。所有字符串里的换行、制表符、回车和英文双引号必须使用合法 JSON 转义。

${schemaInstruction}`
          }
        ],
        responseFormatMode: "plain"
      });
    } catch (error) {
      if (lastRepairableParseError?.responseContent) {
        try {
          return await runModelJsonRepairAttempt(lastRepairableParseError);
        } catch {
          // Keep the compatibility fallback error in the final summary.
        }
      }

      const message = `AI JSON output failed validation after compatibility fallback. First error: ${formatErrorMessage(
        firstError
      )}. Retry error: ${formatErrorMessage(
        retryError
      )}. Last error: ${formatErrorMessage(error)}`;

      throw buildError(message);
    }
  }

  if (lastRepairableParseError?.responseContent) {
    try {
      return await runModelJsonRepairAttempt(lastRepairableParseError);
    } catch {
      // Keep the normal retry error in the final summary.
    }
  }

  throw buildError(
    `AI JSON output failed validation after retry. First error: ${formatErrorMessage(
      firstError
    )}. Last error: ${formatErrorMessage(retryError)}`
  );
}
