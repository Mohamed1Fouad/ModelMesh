import { z } from "zod";

const contentPartSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("image_url"),
    image_url: z.object({ url: z.string(), detail: z.enum(["low", "high", "auto"]).optional() }),
  }),
  z.object({
    type: z.literal("input_audio"),
    input_audio: z.object({ data: z.string(), format: z.enum(["wav", "mp3"]) }),
  }),
]);

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(contentPartSchema)]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
});

const toolSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any()),
  }),
});

export const chatCompletionSchema = z.object({
  model: z.string().optional(),
  messages: z.array(messageSchema).min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  tools: z.array(toolSchema).optional(),
  tool_choice: z.union([z.string(), z.object({ type: z.string(), function: z.object({ name: z.string() }) })]).optional(),
  response_format: z.object({ type: z.enum(["text", "json_object"]) }).optional(),
  privacy: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  user: z.string().optional(),
});

export type ChatCompletionBody = z.infer<typeof chatCompletionSchema>;
