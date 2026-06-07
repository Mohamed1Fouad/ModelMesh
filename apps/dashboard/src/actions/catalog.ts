"use server";

import { prisma } from "@modelmesh/db";

export async function getProviderCatalog(providerName?: string) {
  return prisma.providerModelCatalog.findMany({
    where: {
      enabled: true,
      ...(providerName ? { providerName: providerName.toLowerCase() } : {}),
    },
    orderBy: { name: "asc" },
  });
}
