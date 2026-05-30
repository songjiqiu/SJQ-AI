import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type PrismaLike = Pick<PrismaClient, "aiProvider">;

const defaultProviders = [
  {
    name: "ollama",
    slug: "ollama",
    baseUrl: "http://localhost:11434/v1"
  },
  {
    name: "deepseek",
    slug: "deepseek",
    baseUrl: "https://api.deepseek.com"
  }
];

export async function seedDefaultAiProviders(
  userId: string,
  client: PrismaLike = prisma
) {
  await client.aiProvider.createMany({
    data: defaultProviders.map((provider) => ({
      ...provider,
      userId
    })),
    skipDuplicates: true
  });
}
