import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseTrace } from "../src/parser/parser.ts";
import { treeOfTrace } from "../src/parser/tree.ts";
import { flattenVisibleTree } from "../src/parser/flatten.ts";

function fixture(name) {
  const url = new URL(`../fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8"));
}

function parseFixture(name) {
  const result = parseTrace(fixture(name));
  assert.notEqual(result.trace, null);
  return result;
}

test("valid trace keeps extras and builds a tree from out-of-order spans", () => {
  const { trace, issues } = parseFixture("valid");
  assert.equal(issues.length, 0);
  assert.equal(trace.decisions.length, 1);
  assert.equal(trace.spans.find((span) => span.id === "child").unknownAttributes.extraField, "kept");

  const tree = treeOfTrace(trace);
  assert.deepEqual(tree.issues, []);
  assert.equal(tree.roots.length, 1);
  const root = tree.roots[0];
  assert.equal(root.span.id, "root");
  assert.deepEqual(root.children.map((node) => node.span.id), ["peer", "child"]);
  assert.equal(root.depth, 0);
  assert.equal(root.children[1].depth, 1);
  assert.equal(root.children[1].children[0].depth, 2);
  assert.equal(root.descendantCount, 3);
  assert.equal(root.subtreeTokens, 10);
  assert.ok(Math.abs(root.subtreeCostUsd - 0.65) < 1e-10);
  assert.equal(root.subtreeDurationMs, 100);
  assert.equal(root.containsError, true);
  assert.equal(root.containsPendingApproval, true);
});

test("partial trace keeps usable data and reports each rejected or normalized item", () => {
  const { trace, issues } = parseFixture("partial");
  assert.deepEqual(trace.spans.map((span) => span.id), ["good", "odd", "unfinished", "running"]);
  assert.equal(trace.spans.find((span) => span.id === "odd").kind, "span");
  assert.deepEqual(trace.decisions.map((decision) => decision.id), ["orphan"]);
  assert.deepEqual(new Set(issues.map((issue) => issue.code)), new Set([
    "invalid_span", "duplicate_span_id", "trace_id_mismatch", "unknown_kind",
    "clock_skew", "missing_end_time", "missing_edited_arguments",
    "orphan_decision", "invalid_decision",
  ]));
  assert.equal(issues.filter((issue) => issue.code === "missing_end_time").length, 1);
  assert.equal(trace.parseIssues, issues);

  const tree = treeOfTrace(trace);
  assert.equal(tree.roots.length, 4);
  assert.equal(tree.roots.find((node) => node.span.id === "odd").subtreeDurationMs, 0);
  assert.equal(tree.roots.find((node) => node.span.id === "odd").containsWarning, true);
});

test("invalid envelope returns issues without inventing a trace", () => {
  const result = parseTrace({ id: "broken", spans: "not an array" });
  assert.equal(result.trace, null);
  assert.ok(result.issues.every((issue) => issue.code === "invalid_trace"));
});

test("missing parents and cycles remain visible and are reported", () => {
  const { trace } = parseFixture("broken-links");
  const tree = treeOfTrace(trace);
  assert.deepEqual(tree.roots.map((node) => node.span.id), ["b", "lost", "self"]);
  assert.deepEqual(tree.roots[0].children.map((node) => node.span.id), ["a"]);
  assert.equal(tree.issues.filter((issue) => issue.code === "cycle_detected").length, 2);
  assert.equal(tree.issues.filter((issue) => issue.code === "orphan_span").length, 1);
  assert.equal(tree.roots[0].containsError, true);
  assert.equal(tree.roots[0].descendantCount, 1);
});

test("flattening shows roots and only descendants of expanded nodes", () => {
  const { trace } = parseFixture("valid");
  const { roots } = treeOfTrace(trace);
  const ids = (expanded) =>
    flattenVisibleTree(roots, new Set(expanded)).map((node) => node.span.id);

  assert.deepEqual(ids([]), ["root"]);
  assert.deepEqual(ids(["child"]), ["root"]);
  assert.deepEqual(ids(["root"]), ["root", "peer", "child"]);
  assert.deepEqual(ids(["root", "child"]), ["root", "peer", "child", "grandchild"]);
  assert.equal(roots[0].children[1].children.length, 1);
});
