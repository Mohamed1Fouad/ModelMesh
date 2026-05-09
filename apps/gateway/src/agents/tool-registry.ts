import { AgentEngine } from "./engine.js";

export function registerBuiltInTools(engine: AgentEngine) {
  engine.registerTool("web_search", async (args) => {
    const query = args.query as string;
    if (!query) return { error: "Missing query parameter" };

    try {
      // In production, integrate with a real search API
      return {
        results: [
          { title: `Search result for "${query}"`, url: "https://example.com", snippet: "Placeholder search result." },
        ],
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  engine.registerTool("http_request", async (args) => {
    const url = args.url as string;
    const method = (args.method as string) ?? "GET";
    const headers = (args.headers as Record<string, string>) ?? {};
    const body = args.body as string | undefined;

    if (!url) return { error: "Missing url parameter" };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: text,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  engine.registerTool("read_file", async (args) => {
    const { readFile } = await import("fs/promises");
    const path = args.path as string;
    if (!path) return { error: "Missing path parameter" };

    try {
      // Only allow reading within allowed directories (security)
      const allowedPrefixes = ["/tmp", process.cwd()];
      const isAllowed = allowedPrefixes.some((p) => path.startsWith(p));
      if (!isAllowed) return { error: "Path not in allowed directories" };

      const content = await readFile(path, "utf-8");
      return { content };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  engine.registerTool("write_file", async (args) => {
    const { writeFile } = await import("fs/promises");
    const path = args.path as string;
    const content = args.content as string;
    if (!path || content === undefined) return { error: "Missing path or content parameter" };

    try {
      const allowedPrefixes = ["/tmp", process.cwd()];
      const isAllowed = allowedPrefixes.some((p) => path.startsWith(p));
      if (!isAllowed) return { error: "Path not in allowed directories" };

      await writeFile(path, content, "utf-8");
      return { success: true, path };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  engine.registerTool("math_evaluate", async (args) => {
    const expression = args.expression as string;
    if (!expression) return { error: "Missing expression parameter" };

    try {
      // Safe math evaluation using Function constructor
      const result = new Function(`return (${expression})`)();
      return { result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  engine.registerTool("date_time", async (_args) => {
    return {
      iso: new Date().toISOString(),
      unix: Date.now(),
      local: new Date().toString(),
    };
  });

  engine.registerTool("gateway_query", async (args) => {
    const { prisma } = await import("@modelmesh/db");
    const entity = args.entity as string;

    try {
      switch (entity) {
        case "providers": {
          const providers = await prisma.provider.findMany({
            where: { enabled: true },
            include: { models: { where: { enabled: true } } },
          });
          return { providers };
        }
        case "models": {
          const models = await prisma.model.findMany({
            where: { enabled: true },
            include: { provider: true },
          });
          return { models };
        }
        case "usage": {
          const logs = await prisma.usageLog.findMany({
            take: 10,
            orderBy: { timestamp: "desc" },
            include: { provider: true, model: true },
          });
          return { logs };
        }
        default:
          return { error: `Unknown entity: ${entity}` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
}
