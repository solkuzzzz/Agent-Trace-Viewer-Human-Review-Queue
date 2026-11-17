import { TraceSchema, SpanSchema, HumanDecisionSchema } from "./schema.ts";
import type {
   HumanDecision,
   ParseIssue,
   ParseResult,
   Span,
   Trace,
} from "../types/trace.ts"

export function parseTrace(input: unknown): ParseResult {
   const envelope = TraceSchema.safeParse(input)

   if (!envelope.success) {
      return {
         trace: null,
         issues: envelope.error.issues.map((problem) => ({
            severity: 'error',
            code: 'invalid_trace',
            detail: `${problem.path.join(".") || "trace"}: ${problem.message}`,
         }))
      }
   }

   const issues: ParseIssue[] = [];
   const spans: Span[] = [];
   const seenIds = new Set<string>();

   for (const [index, rawSpan] of envelope.data.spans.entries()) {
      const rawKind = typeof rawSpan === "object" &&
         rawSpan !== null && !Array.isArray(rawSpan) &&
         "kind" in rawSpan ? rawSpan.kind : undefined;

      const result = SpanSchema.safeParse(rawSpan)

      if (!result.success) {
         issues.push({
            severity: "error",
            code: "invalid_span",
            spanIndex: index,
            detail: result.error.issues.map((problem) => `${problem.path.join(".")}: ${problem.message}`)
               .join("; "),
         });
         continue;
      }

      if (seenIds.has(result.data.id)) {
         issues.push({
            severity: "error",
            code: "duplicate_span_id",
            spanId: result.data.id,
            spanIndex: index,
            detail: `Повторяется id span: ${result.data.id}`,
         });
         continue;
      }

      seenIds.add(result.data.id);

      const {
         id,
         traceId,
         parentId,
         kind,
         name,
         startTime,
         endTime,
         status,
         statusMessage,
         usage,
         cost,
         llm,
         tool,
         ...unknownAttributes
      } = result.data;

      const span: Span = {
         id,
         traceId,
         parentId,
         kind,
         name,
         startTime,
         endTime,
         status,
         statusMessage,
         usage,
         cost,
         llm,
         tool,
         unknownAttributes,
      };

      if (span.traceId !== envelope.data.id) {
         issues.push({
            severity: "warn",
            code: "trace_id_mismatch",
            spanId: span.id,
            spanIndex: index,
            detail: `Span ${span.id} ссылается на trace ${span.traceId} вместо ${envelope.data.id}`,
         });
      }

      if (rawKind !== span.kind) {
         issues.push({
            severity: "warn",
            code: "unknown_kind",
            spanId: span.id,
            detail: `Неизвестный kind: ${String(rawKind)}`,
         });
      }

      if (span.endTime === null &&
         span.status !== "running" &&
         span.status !== "awaiting_approval") {
         issues.push({
            severity: "warn",
            code: "missing_end_time",
            spanId: span.id,
            detail: `У завершённого span ${span.id} нет endTime`,
         });
      }

      if (span.endTime !== null && span.endTime < span.startTime) {
         issues.push({
            severity: "warn",
            code: "clock_skew",
            spanId: span.id,
            detail: `endTime раньше startTime у span ${span.id}`,
         });
      }

      spans.push(span);
   }

   const decisions: HumanDecision[] = [];

   for (const [index, rawDecision] of envelope.data.decisions.entries()) {
      const result = HumanDecisionSchema.safeParse(rawDecision)

      if (!result.success) {
         issues.push({
            severity: "error",
            code: "invalid_decision",
            decisionIndex: index,
            detail: result.error.issues.map((problem) => `${problem.path.join(".")}: ${problem.message}`)
               .join("; "),
         });
         continue;
      }

      if (result.data.verdict === "edit" && result.data.editedArguments === undefined) {
         issues.push({
            severity: "error",
            code: "missing_edited_arguments",
            spanId: result.data.spanId,
            decisionIndex: index,
            detail: `У решения ${result.data.id} с verdict edit нет editedArguments`,
         });
         continue;
      }

      if (!seenIds.has(result.data.spanId)) {
         issues.push({
            severity: "warn",
            code: "orphan_decision",
            spanId: result.data.spanId,
            decisionIndex: index,
            detail: `Не найден span для решения: ${result.data.spanId}`,
         });
      }

      decisions.push(result.data);

   }

   const trace: Trace = {
      id: envelope.data.id,
      name: envelope.data.name,
      startTime: envelope.data.startTime,
      endTime: envelope.data.endTime,
      spans,
      decisions,
      parseIssues: issues,
   }

   return {trace, issues}
}
