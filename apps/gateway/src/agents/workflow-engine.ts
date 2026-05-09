import { prisma } from "@modelmesh/db";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStepResult,
  AgentRequest,
} from "@modelmesh/shared";
import { AgentEngine } from "./engine.js";

export class WorkflowEngine {
  private agentEngine: AgentEngine;

  constructor(agentEngine: AgentEngine) {
    this.agentEngine = agentEngine;
  }

  async execute(workflowId: string, input: Record<string, unknown>): Promise<WorkflowExecution> {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new WorkflowError(`Workflow not found: ${workflowId}`);
    }

    const dbExecution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        status: "running",
        input: input as object,
      },
    });

    const execution: WorkflowExecution = {
      id: dbExecution.id,
      workflowId,
      status: "running",
      input,
      startedAt: new Date(),
      stepResults: [],
    };

    const state: Record<string, unknown> = { ...input };

    try {
      for (const step of workflow.steps) {
        const dbStepResult = await prisma.workflowStepResult.create({
          data: {
            executionId: execution.id,
            stepId: step.id,
            status: "running",
            input: this.mapInput(step.inputMapping, state) as object,
          },
        });

        const stepInput = this.mapInput(step.inputMapping, state);
        const agentRequest: AgentRequest = {
          agentId: step.agentId,
          messages: [
            {
              role: "user",
              content: typeof stepInput === "string" ? stepInput : JSON.stringify(stepInput),
            },
          ],
        };

        const agentResponse = await this.agentEngine.execute(agentRequest);

        const stepOutput = agentResponse.content;
        this.mapOutput(step.outputMapping, state, stepOutput);

        await prisma.workflowStepResult.update({
          where: { id: dbStepResult.id },
          data: {
            status: "completed",
            output: { content: stepOutput } as object,
            completedAt: new Date(),
          },
        });

        execution.stepResults.push({
          id: dbStepResult.id,
          stepId: step.id,
          status: "completed",
          input: stepInput as Record<string, unknown>,
          output: { content: stepOutput },
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }

      execution.status = "completed";
      execution.output = state;
      execution.completedAt = new Date();

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "completed",
          output: state as object,
          completedAt: new Date(),
        },
      });

      return execution;
    } catch (err) {
      execution.status = "failed";
      execution.error = err instanceof Error ? err.message : String(err);

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "failed",
          error: execution.error,
          completedAt: new Date(),
        },
      });

      return execution;
    }
  }

  private async loadWorkflow(id: string): Promise<WorkflowDefinition | null> {
    const db = await prisma.workflow.findUnique({
      where: { id },
      include: { steps: { include: { agent: true }, orderBy: { order: "asc" } } },
    });

    if (!db) return null;

    return {
      id: db.id,
      name: db.name,
      description: db.description ?? undefined,
      steps: db.steps.map((s) => ({
        id: s.id,
        agentId: s.agentId,
        name: s.name,
        inputMapping: (s.inputMapping as Record<string, string>) ?? {},
        outputMapping: (s.outputMapping as Record<string, string>) ?? {},
        order: s.order,
      })),
    };
  }

  private mapInput(
    mapping: Record<string, string>,
    state: Record<string, unknown>
  ): unknown {
    if (Object.keys(mapping).length === 0) {
      return state;
    }

    const result: Record<string, unknown> = {};
    for (const [key, path] of Object.entries(mapping)) {
      result[key] = this.getValueByPath(state, path);
    }
    return result;
  }

  private mapOutput(
    mapping: Record<string, string>,
    state: Record<string, unknown>,
    output: string
  ): void {
    if (Object.keys(mapping).length === 0) {
      state.result = output;
      return;
    }

    for (const [key, path] of Object.entries(mapping)) {
      if (key === "_content") {
        this.setValueByPath(state, path, output);
      } else {
        this.setValueByPath(state, path, this.getValueByPath({ output }, key));
      }
    }
  }

  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
}

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}
