import type { ParseIssue, Trace, TraceNode, TreeResult } from "../types/trace";

export function treeOfTrace(trace: Trace): TreeResult {
  const nodes = new Map<string, TraceNode>();
  const roots: TraceNode[] = [];
  const issues: ParseIssue[] = [];

  for (const span of trace.spans) {
    nodes.set(span.id, {
      span,
      children: [],
      depth: 0,
      subtreeDurationMs: 0,
      subtreeCostUsd: 0,
      subtreeTokens: 0,
      containsError: false,
      containsWarning: false,
      containsPendingApproval: false,
      descendantCount: 0,
    });
  }

  // Only accepted links are stored here. A rejected link makes that node a root.
  const attachedParent = new Map<string, string>();
  for (const span of trace.spans) {
    const node = nodes.get(span.id)!;
    if (span.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(span.parentId);
    if (parent === undefined) {
      roots.push(node);
      issues.push({
        severity: "warn",
        code: "orphan_span",
        spanId: span.id,
        detail: `Не найден родитель ${span.parentId} для span ${span.id}`,
      });
      continue;
    }

    // Following accepted parent links detects a cycle before adding its last edge.
    let ancestorId: string | undefined = span.parentId;
    let createsCycle = false;
    while (ancestorId !== undefined) {
      if (ancestorId === span.id) {
        createsCycle = true;
        break;
      }
      ancestorId = attachedParent.get(ancestorId);
    }

    if (createsCycle) {
      roots.push(node);
      issues.push({
        severity: "error",
        code: "cycle_detected",
        spanId: span.id,
        detail: `Связь ${span.id} → ${span.parentId} создаёт цикл`,
      });
      continue;
    }

    parent.children.push(node);
    attachedParent.set(span.id, span.parentId);
  }

  const issuesBySpanId = new Map<string, { error: boolean; warning: boolean }>();
  for (const issue of [...trace.parseIssues, ...issues]) {
    if (issue.spanId === undefined) continue;
    const flags = issuesBySpanId.get(issue.spanId) ?? { error: false, warning: false };
    if (issue.severity === "error") flags.error = true;
    else flags.warning = true;
    issuesBySpanId.set(issue.spanId, flags);
  }

  // Preorder establishes depths; reverse order lets children finish before parents.
  const preorder: TraceNode[] = [];
  const stack = roots.map((node) => ({ node, depth: 0 })).reverse();
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    node.depth = depth;
    preorder.push(node);
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push({ node: node.children[i], depth: depth + 1 });
    }
  }

  const bounds = new Map<TraceNode, { start: number; end: number }>();
  for (let i = preorder.length - 1; i >= 0; i--) {
    const node = preorder[i];
    const { span } = node;
    const flags = issuesBySpanId.get(span.id);
    let start = span.startTime;
    // Missing or reversed end times cannot create a negative duration.
    let end = Math.max(span.startTime, span.endTime ?? span.startTime);

    node.subtreeTokens = span.usage?.totalTokens ??
      (span.usage?.inputTokens ?? 0) + (span.usage?.outputTokens ?? 0);
    node.subtreeCostUsd = span.cost?.totalUsd ??
      (span.cost?.inputUsd ?? 0) + (span.cost?.outputUsd ?? 0);
    node.containsError = span.status === "error" || (flags?.error ?? false);
    node.containsWarning = span.status === "warning" || (flags?.warning ?? false);
    node.containsPendingApproval = span.status === "awaiting_approval";

    for (const child of node.children) {
      const childBounds = bounds.get(child)!;
      start = Math.min(start, childBounds.start);
      end = Math.max(end, childBounds.end);
      node.subtreeTokens += child.subtreeTokens;
      node.subtreeCostUsd += child.subtreeCostUsd;
      node.descendantCount += 1 + child.descendantCount;
      node.containsError ||= child.containsError;
      node.containsWarning ||= child.containsWarning;
      node.containsPendingApproval ||= child.containsPendingApproval;
    }

    node.subtreeDurationMs = end - start;
    bounds.set(node, { start, end });
  }

  return { roots, issues };
}
