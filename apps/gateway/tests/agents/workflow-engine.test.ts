import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowEngine, WorkflowError } from "../../src/agents/workflow-engine.js";
import { AgentEngine } from "../../src/agents/engine.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    workflow: {
      findUnique: vi.fn(),
    },
    workflowExecution: {
      create: vi.fn(),
      update: vi.fn(),
    },
    workflowStepResult: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@modelmesh/db";

describe("WorkflowEngine", () => {
  const mockAgentEngine = { execute: vi.fn() } as unknown as AgentEngine;
  const engine = new WorkflowEngine(mockAgentEngine);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeWorkflow(overrides: any = {}) {
    return {
      id: "wf-1",
      name: "Test Workflow",
      description: "A test workflow",
      steps: [
        {
          id: "step-1",
          agentId: "agent-1",
          name: "Greet",
          inputMapping: { name: "input.name" },
          outputMapping: { _content: "greeting" },
          order: 0,
        },
        {
          id: "step-2",
          agentId: "agent-2",
          name: "Summarize",
          inputMapping: { greeting: "greeting" },
          outputMapping: { _content: "summary" },
          order: 1,
        },
      ],
      ...overrides,
    };
  }

  it("throws when workflow not found", async () => {
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(null);
    await expect(engine.execute("missing", { name: "Test" })).rejects.toThrow(WorkflowError);
  });

  it("executes workflow steps sequentially", async () => {
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(makeWorkflow() as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);

    vi.mocked(mockAgentEngine.execute)
      .mockResolvedValueOnce({ content: "Hello Test", sessionId: "s1", iteration: 1, done: true })
      .mockResolvedValueOnce({ content: "Summary here", sessionId: "s2", iteration: 1, done: true });

    const result = await engine.execute("wf-1", { name: "Test" });

    expect(result.status).toBe("completed");
    expect(result.stepResults).toHaveLength(2);
    expect(result.output).toEqual({ name: "Test", greeting: "Hello Test", summary: "Summary here" });
    expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) })
    );
  });

  it("maps input with empty mapping to full state", async () => {
    const wf = makeWorkflow({
      steps: [
        { id: "step-1", agentId: "agent-1", name: "Echo", inputMapping: {}, outputMapping: { _content: "result" }, order: 0 },
      ],
    });
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(wf as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockResolvedValue({ content: "OK", sessionId: "s1", iteration: 1, done: true });

    const result = await engine.execute("wf-1", { foo: "bar" });
    expect(result.output).toEqual({ foo: "bar", result: "OK" });

    const callArg = vi.mocked(mockAgentEngine.execute).mock.calls[0][0];
    expect(callArg.messages[0].content).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("maps output to nested path with _content", async () => {
    const wf = makeWorkflow({
      steps: [
        { id: "step-1", agentId: "agent-1", name: "Parse", inputMapping: {}, outputMapping: { _content: "nested.result" }, order: 0 },
      ],
    });
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(wf as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockResolvedValue({ content: "42", sessionId: "s1", iteration: 1, done: true });

    const result = await engine.execute("wf-1", {});
    expect((result.output as any).nested).toEqual({ result: "42" });
  });

  it("marks execution failed on step error", async () => {
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(makeWorkflow() as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockRejectedValue(new Error("Agent failed"));

    const result = await engine.execute("wf-1", { name: "Test" });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Agent failed");
    expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) })
    );
  });

  it("handles non-Error throw in catch block", async () => {
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(makeWorkflow() as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockRejectedValue("string error");

    const result = await engine.execute("wf-1", { name: "Test" });
    expect(result.error).toBe("string error");
  });

  it("creates DB execution record at start", async () => {
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(makeWorkflow() as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockResolvedValue({ content: "Done", sessionId: "s1", iteration: 1, done: true });

    await engine.execute("wf-1", { name: "Test" });

    expect(prisma.workflowExecution.create).toHaveBeenCalledWith({
      data: { workflowId: "wf-1", status: "running", input: { name: "Test" } },
    });
  });

  it("updates step result on completion", async () => {
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(makeWorkflow() as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockResolvedValue({ content: "Done", sessionId: "s1", iteration: 1, done: true });

    await engine.execute("wf-1", { name: "Test" });

    expect(prisma.workflowStepResult.update).toHaveBeenCalledWith({
      where: { id: "sr-1" },
      data: {
        status: "completed",
        output: { content: "Done" },
        completedAt: expect.any(Date),
      },
    });
  });

  it("maps output with empty mapping to state.result", async () => {
    const wf = makeWorkflow({
      steps: [
        { id: "step-1", agentId: "agent-1", name: "Echo", inputMapping: {}, outputMapping: {}, order: 0 },
      ],
    });
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(wf as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockResolvedValue({ content: "OK", sessionId: "s1", iteration: 1, done: true });

    const result = await engine.execute("wf-1", {});
    expect((result.output as any).result).toBe("OK");
  });

  it("maps output with non-_content key", async () => {
    const wf = makeWorkflow({
      steps: [
        { id: "step-1", agentId: "agent-1", name: "Parse", inputMapping: {}, outputMapping: { summary: "result.summary" }, order: 0 },
      ],
    });
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(wf as any);
    vi.mocked(prisma.workflowExecution.create).mockResolvedValue({ id: "exec-1" } as any);
    vi.mocked(prisma.workflowStepResult.create).mockResolvedValue({ id: "sr-1" } as any);
    vi.mocked(mockAgentEngine.execute).mockResolvedValue({ content: "It works", sessionId: "s1", iteration: 1, done: true });

    const result = await engine.execute("wf-1", {});
    expect((result.output as any).result).toEqual({ summary: undefined });
  });
});
