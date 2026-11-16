import { z } from "zod";

export const SpanKindSchema = z
  .enum(["agent", "llm_call", "tool_call", "retrieval", "event", "span"])
  .catch("span");

export type SpanKind = z.infer<typeof SpanKindSchema>;

export const SpanStatusSchema = z.enum([
  "ok",
  "error",
  "warning",
  "running",
  "awaiting_approval",
  "cancelled",
]);

export const RiskTierSchema = z.enum(["read", "write", "execute"]);

export const UsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
});

export const CostSchema = z.object({
  inputUsd: z.number().optional(),
  outputUsd: z.number().optional(),
  totalUsd: z.number().optional(),
});

export const RequestedToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.unknown(),
});

export const LlmPayloadSchema = z.object({
  model: z.string(),
  provider: z.string().optional(),
  requestedToolCalls: z.array(RequestedToolCallSchema).optional(),
  attempt: z.number().optional(),
  messagesRedacted: z.boolean().optional(),
  messages: z.unknown().optional(),
});

export const ToolPayloadSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  riskTier: RiskTierSchema,
  arguments: z.unknown(),
  result: z.unknown().optional(),
  attempt: z.number().optional(),
});

export const SpanSchema = z
  .object({
    id: z.string(),
    traceId: z.string(),
    parentId: z.string().nullable(),
    kind: SpanKindSchema,
    name: z.string(),
    startTime: z.number(),
    endTime: z.number().nullable(),
    status: SpanStatusSchema,
    statusMessage: z.string().optional(),
    usage: UsageSchema.optional(),
    cost: CostSchema.optional(),
    llm: LlmPayloadSchema.optional(),
    tool: ToolPayloadSchema.optional(),
  })
  .passthrough();

export const HumanDecisionSchema = z.object({
  id: z.string(),
  spanId: z.string(),
  verdict: z.enum(["approve", "deny", "edit"]),
  editedArguments: z.unknown().optional(),
  rationale: z.string().optional(),
  issueTags: z.array(z.string()).optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  decidedAt: z.number(),
  decidedBy: z.string(),
});

export const TraceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    startTime: z.number(),
    endTime: z.number().nullable(),
    spans: z.array(z.unknown()),
    decisions: z.array(HumanDecisionSchema).optional().default([]),
  })
  .passthrough();
