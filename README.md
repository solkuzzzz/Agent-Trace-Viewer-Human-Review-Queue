# Agent Trace Viewer & Human Review Queue

A frontend tool for analyzing AI agent runs: a timeline of what happened, a detailed view of the reasons, and a review queue for approving, rejecting, or editing risky actions before they execute.

Agent logs are written for machines — JSONL, nested spans, token counters.

---

## Why this project exists

Agents are increasingly run without constant supervision, and the question teams face is not "is the agent capable of completing the task" but **"will I leave it running unattended, and if something goes wrong, will I be able to quickly understand what happened and intervene in time?"**

This is the second problem — and it's a frontend one: information density, state management, keyboard-first interaction, and honest handling of partial or corrupted data. Currently it's poorly addressed through homemade internal dashboards built by people whose main job is not frontend.

Most existing solutions — Langfuse, LangSmith, and similar — are _post-hoc observability_: the trace is read after the run completes to understand what happened. An underappreciated scenario is _interventional_: a human is in the loop while the agent is paused and must approve, reject, or correct an action before it executes. Tasks 1–4 below are what existing tools already solve well; tasks 5–6 are the reason this one is needed.

## Who this tool is for

- **Primary audience: an engineer debugging a failed, slow, or looping agent run.**
- **Secondary audience: a reviewer who must approve a risky action before execution.**

## What the app can do

- **Timeline** — nested spans (agent → tool call → LLM call), duration bars, collapse/expand, status via icon _and_ text (never color alone), cost and token totals aggregated over the tree.
- **Detail panel** — progressive disclosure: brief summary → reasoning/arguments → full raw payload, with a diff view across attempts.
- **Approval gates** — action gates with risk level (read / write / execute); the reviewer can approve, reject, or **edit the arguments** and let the run continue with the correction.
- **Review queue** — structured human verdicts (pass/fail, issue tags, severity, free text), exportable as an audit trail.
- **Graph view** — execution as a node/edge graph, with aggregation of repeated actions (e.g., `retrieve_docs (3/3)`) so a looping agent remains readable.
- **Replay mode** — a recorded run played back in real time — for demos and for seeing "how it looked at execution time."

Everything runs on recorded fixture traces.

### Why a tree is necessary but not sufficient

Hierarchy is the correct primary representation: an agent run _is_ a tree (agent → LLM call → tool call → sub-agent → …). But a tree alone handles scanning poorly: in a 200-node tree, fully collapsed, an error three levels deep is invisible, and expanding everything yields an unreadable wall. Therefore the tree is supplemented by four mechanisms:

1. **Error aggregation** — a collapsed parent signals that its subtree contains an error, warning, or pending approval.
2. **Metric aggregation** — a collapsed parent shows the total duration, cost, and tokens of everything beneath it.
3. **Duration bars** — scaled relative to the total run duration (not the parent's), so branches remain visually comparable.
4. **Filters and jump** — "show only errors", "jump to next error" — turn the tree from a browsing structure into a searching structure.

## Tech stack

- React 19 + TypeScript (strict) + Vite
- TanStack Virtual for large trace lists
- Zustand for state
- CSS Modules
- Vitest + Testing Library, Playwright for e2e
- axe-core in CI for accessibility
- Deploy on Vercel; no backend

## Quick start

```bash
git clone https://github.com/<you>/agent-trace-viewer.git
cd agent-trace-viewer
npm install
npm run dev
```

No API keys or backend needed — the app runs entirely on fixture traces from `fixtures/`.

## Project structure (in process)

```
fixtures/          recorded sample traces (successful run, failure, loop,
                    approval-required, stress test with 800+ spans, corrupted)
src/
  types/           Span / TraceNode / ToolPayload / LlmPayload / HumanDecision
  parser/          defensive trace parsing, Zod schemas, tree building + aggregates
  views/           timeline, details, graph, queue
  state/           Zustand stores
docs/
  schema-notes.md  where fixtures diverge from OTel GenAI conventions and why
  decisions/       short ADR-style notes on non-obvious decisions
```

## License

MIT — see [LICENSE](./LICENSE).
