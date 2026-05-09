"use server";

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";

export async function getApiKeys() {
  return prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createApiKey(data: {
  name: string;
  scopes?: string[];
  rateLimitRpm?: number;
  rateLimitTpm?: number;
  expiresAt?: Date;
}) {
  const rawKey = `mm-${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 8);

  await prisma.apiKey.create({
    data: {
      name: data.name,
      keyHash,
      keyPrefix,
      scopes: data.scopes ?? ["chat:write"],
      rateLimitRpm: data.rateLimitRpm,
      rateLimitTpm: data.rateLimitTpm,
      expiresAt: data.expiresAt,
    },
  });

  revalidatePath("/api-keys");
  return { rawKey, keyPrefix };
}

export async function revokeApiKey(id: string) {
  await prisma.apiKey.delete({ where: { id } });
  revalidatePath("/api-keys");
}
