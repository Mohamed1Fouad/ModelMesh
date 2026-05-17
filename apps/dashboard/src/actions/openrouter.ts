"use server";

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { OpenRouterModel } from "@/lib/openrouter";

const CACHE_DIR = join(process.cwd(), ".cache");
const CACHE_FILE = join(CACHE_DIR, "openrouter-models.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  models: OpenRouterModel[];
  fetchedAt: number;
}

function readCache(): CacheEntry | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(entry));
  } catch {
    // silent fail
  }
}

async function fetchModels(): Promise<OpenRouterModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    console.error("Failed to fetch OpenRouter models:", res.status);
    return [];
  }
  const data = await res.json();
  return data.data || [];
}

export async function getOpenRouterModels(): Promise<OpenRouterModel[]> {
  const cached = readCache();
  if (cached) return cached.models;

  const models = await fetchModels();
  writeCache({ models, fetchedAt: Date.now() });
  return models;
}

export async function getOpenRouterModelsForProvider(providerName: string): Promise<OpenRouterModel[]> {
  const all = await getOpenRouterModels();
  const prefix = `${providerName.toLowerCase()}/`;
  return all.filter((m) => m.id.toLowerCase().startsWith(prefix));
}
