import { describe, it, expect, vi } from "vitest";
import { registerBuiltInTools } from "../../src/agents/tool-registry.js";
import { AgentEngine } from "../../src/agents/engine.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    provider: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    model: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    usageLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("registerBuiltInTools", () => {
  const engine = new AgentEngine();

  it("registers all built-in tools", () => {
    registerBuiltInTools(engine);
    expect(engine["toolRegistry"].size).toBe(7);
  });

  it("web_search returns error without query", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("web_search")!({});
    expect(result).toEqual({ error: "Missing query parameter" });
  });

  it("web_search returns placeholder result", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("web_search")!({ query: "vitest" });
    expect(result).toEqual({
      results: [{ title: 'Search result for "vitest"', url: "https://example.com", snippet: "Placeholder search result." }],
    });
  });

  it("http_request returns error without url", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("http_request")!({});
    expect(result).toEqual({ error: "Missing url parameter" });
  });

  it("read_file returns error without path", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("read_file")!({});
    expect(result).toEqual({ error: "Missing path parameter" });
  });

  it("read_file rejects disallowed path", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("read_file")!({ path: "/etc/passwd" });
    expect(result).toEqual({ error: "Path not in allowed directories" });
  });

  it("write_file returns error without path or content", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("write_file")!({ path: "/tmp/test.txt" });
    expect(result).toEqual({ error: "Missing path or content parameter" });
  });

  it("write_file rejects disallowed path", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("write_file")!({ path: "/etc/passwd", content: "x" });
    expect(result).toEqual({ error: "Path not in allowed directories" });
  });

  it("math_evaluate returns error without expression", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("math_evaluate")!({});
    expect(result).toEqual({ error: "Missing expression parameter" });
  });

  it("math_evaluate computes expression", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("math_evaluate")!({ expression: "2 + 3 * 4" });
    expect(result).toEqual({ result: 14 });
  });

  it("date_time returns current date info", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("date_time")!({});
    expect(result).toHaveProperty("iso");
    expect(result).toHaveProperty("unix");
    expect(result).toHaveProperty("local");
  });

  it("gateway_query returns error for unknown entity", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("gateway_query")!({ entity: "unknown" });
    expect(result).toEqual({ error: "Unknown entity: unknown" });
  });

  it("gateway_query lists providers", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("gateway_query")!({ entity: "providers" });
    expect(result).toHaveProperty("providers");
  });

  it("gateway_query lists models", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("gateway_query")!({ entity: "models" });
    expect(result).toHaveProperty("models");
  });

  it("gateway_query lists usage", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("gateway_query")!({ entity: "usage" });
    expect(result).toHaveProperty("logs");
  });

  it("http_request fetches and returns response", async () => {
    registerBuiltInTools(engine);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => '{"ok":true}',
    } as any);
    const result = await engine["toolRegistry"].get("http_request")!({ url: "https://example.com", method: "GET" });
    expect(result).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
    });
  });

  it("read_file reads allowed file", async () => {
    registerBuiltInTools(engine);
    const fs = await import("fs/promises");
    await fs.writeFile("/tmp/tool-test.txt", "hello", "utf-8");
    const result = await engine["toolRegistry"].get("read_file")!({ path: "/tmp/tool-test.txt" });
    expect(result).toEqual({ content: "hello" });
    await fs.unlink("/tmp/tool-test.txt");
  });

  it("write_file writes allowed file", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("write_file")!({ path: "/tmp/tool-write.txt", content: "world" });
    expect(result).toEqual({ success: true, path: "/tmp/tool-write.txt" });
    const fs = await import("fs/promises");
    const content = await fs.readFile("/tmp/tool-write.txt", "utf-8");
    expect(content).toBe("world");
    await fs.unlink("/tmp/tool-write.txt");
  });

  it("gateway_query handles db error", async () => {
    registerBuiltInTools(engine);
    const { prisma } = await import("@modelmesh/db");
    vi.mocked(prisma.provider.findMany).mockRejectedValue(new Error("DB fail"));
    const result = await engine["toolRegistry"].get("gateway_query")!({ entity: "providers" });
    expect(result).toEqual({ error: "DB fail" });
  });

  it("read_file returns error on fs failure", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("read_file")!({ path: "/tmp" });
    expect(result).toHaveProperty("error");
  });

  it("write_file returns error on fs failure", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("write_file")!({ path: "/tmp/nonexistent-dir-12345/file.txt", content: "x" });
    expect(result).toHaveProperty("error");
  });

  it("math_evaluate returns error on invalid expression", async () => {
    registerBuiltInTools(engine);
    const result = await engine["toolRegistry"].get("math_evaluate")!({ expression: "2 +" });
    expect(result).toHaveProperty("error");
  });

  it("http_request returns error on fetch failure", async () => {
    registerBuiltInTools(engine);
    global.fetch = vi.fn().mockRejectedValue(new Error("Network fail"));
    const result = await engine["toolRegistry"].get("http_request")!({ url: "https://example.com", method: "GET" });
    expect(result).toEqual({ error: "Network fail" });
  });

  it("web_search returns error on unexpected throw", async () => {
    registerBuiltInTools(engine);
    const throwingQuery = { toString: () => { throw new Error("Search fail"); } };
    const result = await engine["toolRegistry"].get("web_search")!({ query: throwingQuery });
    expect(result).toEqual({ error: "Search fail" });
  });
});
