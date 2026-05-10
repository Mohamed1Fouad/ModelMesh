/**
 * ModelMesh — OpenClaw Plugin
 *
 * Registers ModelMesh as a model provider in OpenClaw.
 * Forwards chat completion requests to the ModelMesh gateway.
 */

import { createProviderForwarder } from "./provider.js";
import type { ServerResponse } from "node:http";

export const id = "modelmesh";

export default function register(api: any) {
  const logger = api.logger ?? console;

  const getPluginConfig = () => {
    return (
      api.config?.plugins?.entries?.["modelmesh"]?.config ??
      api.config?.plugins?.entries?.["@modelmesh/openclaw-plugin"]?.config ??
      {}
    );
  };

  const forwarder = createProviderForwarder(getPluginConfig, logger);

  // ─── Register as OpenClaw Provider ───
  api.registerProvider?.({
    id: "modelmesh",
    name: "ModelMesh",
    apiType: "openai-completions",
    baseUrl: () => {
      const cfg = getPluginConfig();
      return cfg.baseUrl ?? "http://localhost:3000";
    },
    models: async () => {
      try {
        const models = await forwarder.listModels();
        return [
          { id: "auto", name: "Auto-route", contextWindow: undefined, capabilities: [] },
          ...models.map((m: any) => ({
            id: m.id,
            name: m.name ?? m.id,
            contextWindow: m.contextWindow ?? undefined,
            capabilities: m.capabilities ?? [],
          })),
        ];
      } catch (err: any) {
        logger.error(`[modelmesh] Failed to list models: ${err.message}`);
        return [{ id: "auto", name: "Auto-route" }];
      }
    },
  });

  // ─── CLI Command: /modelmesh ───
  api.registerCommand?.({
    name: "modelmesh",
    description: "Show ModelMesh provider status",
    handler: async () => {
      const cfg = getPluginConfig();
      const baseUrl = cfg.baseUrl ?? "http://localhost:3000";

      try {
        const models = await forwarder.listModels();
        const lines = [
          "📡 **ModelMesh Provider**",
          `Gateway: ${baseUrl}`,
          `Models: ${models.length}`,
          "",
          "**Available Models:**",
          ...models.map((m: any) => `  - ${m.name ?? m.id}`),
        ];
        return { text: lines.join("\n") };
      } catch (err: any) {
        return {
          text: `⚠️ ModelMesh unreachable at ${baseUrl}\n${err.message}`,
        };
      }
    },
  });

  // ─── CLI Command: /modelmesh-doctor ───
  api.registerCommand?.({
    name: "modelmesh-doctor",
    description: "Health check for ModelMesh gateway",
    handler: async () => {
      const cfg = getPluginConfig();
      const baseUrl = cfg.baseUrl ?? "http://localhost:3000";
      const issues: string[] = [];
      const ok: string[] = [];

      try {
        const res = await fetch(`${baseUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          ok.push(`Gateway healthy at ${baseUrl}`);
        } else {
          issues.push(`Gateway returned ${res.status}`);
        }
      } catch (err: any) {
        issues.push(`Cannot reach ${baseUrl}: ${err.message}`);
      }

      try {
        const models = await forwarder.listModels();
        ok.push(`${models.length} models available`);
      } catch {
        issues.push("Failed to list models");
      }

      const lines = ["🩺 **ModelMesh Doctor**", ""];
      for (const o of ok) lines.push(`✓ ${o}`);
      for (const i of issues) lines.push(`⚠ ${i}`);
      if (issues.length === 0) lines.push("", "All good! ✓");

      return { text: lines.join("\n") };
    },
  });

  logger.info("[modelmesh] Plugin registered");
}
