#!/usr/bin/env node
import { Command } from "commander";
import { ModelMeshClient } from "@modelmesh/sdk";

const program = new Command();

program
  .name("mm")
  .description("ModelMesh CLI — interact with your AI routing gateway")
  .version("0.1.0");

program
  .command("chat")
  .description("Send a chat completion request")
  .option("-u, --url <url>", "Gateway URL", process.env.MODELMESH_URL || "http://localhost:3000")
  .option("-k, --key <key>", "API key", process.env.MODELMESH_API_KEY)
  .option("-m, --model <model>", "Model ID", "auto")
  .option("--stream", "Enable streaming", false)
  .argument("[message]", "User message")
  .action(async (message, options) => {
    const client = new ModelMeshClient({
      baseUrl: options.url,
      apiKey: options.key,
    });

    const messages = [{ role: "user" as const, content: message || "Hello" }];

    if (options.stream) {
      for await (const chunk of client.chatCompletionStream({ model: options.model, messages })) {
        process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
      }
      process.stdout.write("\n");
    } else {
      const response = await client.chatCompletion({ model: options.model, messages });
      console.log(response.choices[0]?.message?.content ?? "");
    }
  });

program
  .command("models")
  .description("List available models")
  .option("-u, --url <url>", "Gateway URL", process.env.MODELMESH_URL || "http://localhost:3000")
  .option("-k, --key <key>", "API key", process.env.MODELMESH_API_KEY)
  .action(async (options) => {
    const client = new ModelMeshClient({
      baseUrl: options.url,
      apiKey: options.key,
    });

    const models = await client.listModels();
    for (const m of models) {
      console.log(`${m.id.padEnd(35)} ${m.owned_by}`);
    }
  });

program.parse();
