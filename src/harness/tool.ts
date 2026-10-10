import type { z } from 'zod'

// A tool is something the model can ask us to do.
// The model sees name + description + schema; only our code ever runs execute.
// snippet/guidelines feed the system prompt (see harness/systemPrompt.ts).
export interface Tool<S extends z.ZodTypeAny = z.ZodTypeAny, R = unknown> {
  name: string
  description: string
  snippet: string
  guidelines?: string[]
  schema: S
  execute: (input: z.infer<S>) => Promise<R>
}

export function defineTool<S extends z.ZodTypeAny, R>(tool: Tool<S, R>): Tool<S, R> {
  return tool
}
