import { z, type ZodType } from "zod";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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
  constructor(message: string) {
    super(message);
    this.name = "AiJsonError";
  }
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    return JSON.parse(withoutFence);
  }

  return JSON.parse(trimmed);
}

async function createJsonCompletion({
  client,
  messages,
  model,
  schema,
  schemaName,
  strict,
  temperature
}: {
  client: JsonChatClient;
  messages: ChatMessage[];
  model: string;
  schema: ZodType;
  schemaName: string;
  strict: boolean;
  temperature: number;
}) {
  const responseFormat = strict
    ? {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: z.toJSONSchema(schema)
        }
      }
    : {
        type: "json_object"
      };

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    response_format: responseFormat
  });
  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new AiJsonError("AI response did not include JSON content.");
  }

  return parseJsonContent(content);
}

export async function generateValidatedJson<T>({
  client,
  messages,
  model,
  temperature = 0.2,
  schema,
  schemaName
}: {
  client: JsonChatClient;
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  schema: ZodType<T>;
  schemaName: string;
}) {
  let firstError: unknown;

  try {
    const value = await createJsonCompletion({
      client,
      messages,
      model,
      schema,
      schemaName,
      strict: true,
      temperature
    });

    return schema.parse(value);
  } catch (error) {
    firstError = error;
  }

  try {
    const value = await createJsonCompletion({
      client,
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "上一次输出未通过结构化校验。请只返回一个严格 JSON 对象，不要 Markdown，不要解释，字段必须完整。"
        }
      ],
      model,
      schema,
      schemaName,
      strict: false,
      temperature
    });

    return schema.parse(value);
  } catch (error) {
    throw new AiJsonError(
      `AI JSON output failed validation after retry. First error: ${
        firstError instanceof Error ? firstError.message : String(firstError)
      }. Last error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
