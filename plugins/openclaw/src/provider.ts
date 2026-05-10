/**
 * ModelMesh Provider Forwarder
 *
 * Forwards OpenClaw chat completion requests to the ModelMesh gateway.
 */

import type { ServerResponse } from "node:http";

export function createProviderForwarder(
  getPluginConfig: () => Record<string, unknown>,
  logger: any,
) {
  function getAuthHeaders(): Record<string, string> {
    const cfg = getPluginConfig();
    const apiKey = (cfg.apiKey as string) ?? "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["X-API-Key"] = apiKey;
    }
    return headers;
  }

  function getBaseUrl(): string {
    const cfg = getPluginConfig();
    return (cfg.baseUrl as string) ?? "http://localhost:3000";
  }

  function getTimeoutMs(): number {
    const cfg = getPluginConfig();
    return (cfg.timeoutMs as number) ?? 120_000;
  }

  async function listModels(): Promise<any[]> {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`ModelMesh ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as any;
    return data.data ?? [];
  }

  async function forwardChatCompletion(
    req: any,
    modelId: string,
    res: ServerResponse,
    stream: boolean,
  ) {
    const baseUrl = getBaseUrl();
    const timeoutMs = getTimeoutMs();

    // Strip the "modelmesh/" prefix if present
    const actualModel = modelId.replace(/^modelmesh\//, "");

    const body: Record<string, unknown> = {
      model: actualModel || "auto",
      messages: req.messages,
      stream,
    };

    if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;
    if (req.max_completion_tokens !== undefined) body.max_completion_tokens = req.max_completion_tokens;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.top_p !== undefined) body.top_p = req.top_p;
    if (req.tools?.length > 0) body.tools = req.tools;
    if (req.tool_choice !== undefined) body.tool_choice = req.tool_choice;

    const url = `${baseUrl}/v1/chat/completions`;
    const headers = getAuthHeaders();

    logger.info(`[modelmesh] -> ${actualModel} (stream=${stream})`);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortController.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError") {
        throw new Error(`ModelMesh timeout after ${timeoutMs / 1000}s`);
      }
      throw err;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ModelMesh ${response.status}: ${errText}`);
    }

    if (!stream) {
      const data = (await response.json()) as any;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }

    // Streaming
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          res.write(line + "\n");
        }
      }
    } finally {
      if (buffer) res.write(buffer);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }

  return {
    listModels,
    forward: forwardChatCompletion,
  };
}
