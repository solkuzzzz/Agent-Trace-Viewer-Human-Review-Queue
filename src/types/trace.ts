export type SpanKind =
  | "agent"
  | "llm_call"
  | "tool_call"
  | "retrieval"
  | "generating"
  | "event" //?
  | "span";

export type SpanStatus =
  | "ok"
  | "error"
  | "warning"
  | "running"
  | "awaiting_approval"
  | "cancelled";

export type RiskTier = "read" | "write" | "execute";

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface Cost {
  inputUsd?: number;
  outputUsd?: number;
  totalUsd?: number;
}

export interface RequestedToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface LlmPayload {
  model: string;
  provider?: string;
  requestedToolCalls?: RequestedToolCall[];
  attempt?: number;
  messagesRedacted?: boolean;
  messages?: unknown;
}

export interface ToolPayload {
  toolCallId: string;
  toolName: string;
  riskTier: RiskTier;
  arguments: unknown;
  result?: unknown;
  attempt?: number;
}

export interface HumanDecision {
  id: string;
  spanId: string;
  verdict: "approve" | "deny" | "edit";
  editedArguments?: unknown;
  rationale?: string;
  issueTags?: string[];
  severity?: "low" | "medium" | "high";
  decidedAt: number;
  decidedBy: string;
}

export interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  kind: SpanKind;
  name: string;
  startTime: number;
  endTime: number | null;
  status: SpanStatus;
  statusMessage?: string;
  usage?: Usage;
  cost?: Cost;
  llm?: LlmPayload;
  tool?: ToolPayload;
  unknownAttributes: Record<string, unknown>;
}

export interface Trace {
  id: string;
  name: string;
  startTime: number;
  endTime: number | null;
  spans: Span[];
  decisions: HumanDecision[]; //по spanId сортируем
  parseIssues: ParseIssue[];
}

export interface ParseIssue {
  severity: "warn" | "error";
  code:
    | "orphan_span"
    | "missing_end_time"
    | "clock_skew"
    | "unknown_kind"
    | "unparseable_arguments"
    | "duplicate_span_id"
    | "cycle_detected";
  spanId?: string;
  detail: string;
}

export interface TraceNode {
  span: Span;
  children: TraceNode[];
  depth: number;

  subtreeDurationMs: number;
  subtreeCostUsd: number;
  subtreeTokens: number;
  containsError: boolean;
  containsWarning: boolean;
  containsPendingApproval: boolean;
  descendantCount: number;
}