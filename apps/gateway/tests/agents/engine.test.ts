import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentEngine, AgentError } from "../../src/agents/engine.js";

const mockChatCompletion = vi.fn();
const mockChatCompletionStream = vi.fn();

vi.mock("../../src/providers/factory.js", () => ({
  createProviderAdapter: vi.fn(() => ({
    chatCompletion: mockChatCompletion,
    chatCompletionStream: mockChatCompletionStream,
  })),
}));

vi.mock("@modelmesh/db", () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
    },
    agentSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    agentMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@modelmesh/db";
import { createProviderAdapter } from "../../src/providers/factory.js";

describe("AgentEngine", () => {
  const engine = new AgentEngine();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeAgent(overrides: any = {}) {
    return {
      id: "agent-1",
      name: "Test Agent",
      systemPrompt: "You are helpful",
      provider: { name: "openai" },
      model: { externalId: "gpt-4o" },
      tools: [],
      capabilities: [],
      memoryEnabled: false,
      maxIterations: 3,
      ...overrides,
    };
  }

  it("throws when agent not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    await expect(
      engine.execute({ agentId: "missing", messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(AgentError);
  });

  it("executes single-turn chat without tools", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai",
      enabled: true,
      baseUrl: null,
      apiKey: "sk-test",
      timeoutMs: 30000,
      retries: 3,
      weight: 1,
      models: [
        {
          externalId: "gpt-4o",
          name: "GPT-4o",
          capabilities: ["chat"],
          contextWindow: 128000,
          maxTokens: 4096,
          promptPricePer1k: 0.005,
          completionPricePer1k: 0.015,
          currency: "USD",
          supportsStreaming: true,
          supportsToolUse: true,
          latencyTtftMs: 200,
          latencyThroughputTokensPerSec: 80,
          latencyScore: 95,
        },
      ],
    } as any);

    mockChatCompletion.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Hello!" } }],
    });

    const result = await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.content).toBe("Hello!");
    expect(result.sessionId).toBe("sess-1");
    expect(result.done).toBe(true);
    expect(result.iteration).toBe(1);
    expect(createProviderAdapter).toHaveBeenCalledWith("openai");
  });

  it("reuses existing session when sessionId provided", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.findUnique).mockResolvedValue({ id: "existing-sess" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "OK" } }],
    });

    const result = await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: "Hi" }],
      sessionId: "existing-sess",
    });

    expect(result.sessionId).toBe("existing-sess");
    expect(prisma.agentSession.create).not.toHaveBeenCalled();
  });

  it("creates new session when existing not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "new-sess" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "OK" } }],
    });

    const result = await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: "Hi" }],
      sessionId: "missing-sess",
    });

    expect(result.sessionId).toBe("new-sess");
    expect(prisma.agentSession.create).toHaveBeenCalled();
  });

  it("creates new session with default title when no messages", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "OK" } }],
    });

    await engine.execute({
      agentId: "agent-1",
      messages: [],
    });

    expect(prisma.agentSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: "New Session" }),
    }));
  });

  it("executes tools and loops", async () => {
    engine.registerTool("web_search", async (args) => `Results for ${args.query}`);

    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ id: "tc-1", function: { name: "web_search", arguments: JSON.stringify({ query: "weather" }) } }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "The weather is sunny." } }],
      });

    const result = await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: "What's the weather?" }],
      tools: [{ type: "function", function: { name: "web_search", description: "Search", parameters: { type: "object" } } }],
    });

    expect(result.content).toBe("The weather is sunny.");
    expect(result.iteration).toBe(2);
    expect(mockChatCompletion).toHaveBeenCalledTimes(2);
  });

  it("returns error when tool handler not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ id: "tc-1", function: { name: "missing_tool", arguments: "{}" } }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "Done" } }],
      });

    const result = await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: "Run tool" }],
    });

    expect(result.content).toBe("Done");
    expect(result.iteration).toBe(2);
  });

  it("handles tool execution error gracefully", async () => {
    engine.registerTool("bad_tool", async () => { throw new Error("Boom"); });

    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ id: "tc-1", function: { name: "bad_tool", arguments: "{}" } }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "Recovered" } }],
      });

    const result = await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: "Run" }],
    });

    expect(result.content).toBe("Recovered");
  });

  it("handles non-Error tool execution gracefully", async () => {
    engine.registerTool("string_throw", async () => { throw "Boom"; });

    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ id: "tc-1", function: { name: "string_throw", arguments: "{}" } }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "Recovered" } }],
      });

    const result = await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: "Run" }],
    });

    expect(result.content).toBe("Recovered");
  });

  it("throws when provider not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null);

    await expect(
      engine.execute({ agentId: "agent-1", messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow(AgentError);
  });

  it("loads session messages into context", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([
      { id: "m1", role: "user", content: "Previous", createdAt: new Date() },
      { id: "m2", role: "assistant", content: "Answer", createdAt: new Date() },
    ] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "OK" } }],
    });

    await engine.execute({ agentId: "agent-1", messages: [{ role: "user", content: "Hi" }] });

    const bodyArg = mockChatCompletion.mock.calls[0][0];
    expect(bodyArg.messages).toHaveLength(4); // system + 2 history + 1 new
  });

  it("handles array content by stringifying", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(makeAgent() as any);
    vi.mocked(prisma.agentSession.create).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      name: "openai", enabled: true, baseUrl: null, apiKey: null, timeoutMs: 30000, retries: 3, weight: 1, models: [],
    } as any);

    mockChatCompletion.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Got it" } }],
    });

    await engine.execute({
      agentId: "agent-1",
      messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
    });

    const bodyArg = mockChatCompletion.mock.calls[0][0];
    expect(bodyArg.messages[bodyArg.messages.length - 1].content).toBe('[{"type":"text","text":"Hello"}]');
  });
});
