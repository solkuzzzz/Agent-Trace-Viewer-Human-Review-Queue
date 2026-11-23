import { useState } from "react";
import validTrace from "../fixtures/valid.json";
import partialTrace from "../fixtures/partial.json";
import brokenLinksTrace from "../fixtures/broken-links.json";
import { flattenVisibleTree } from "./parser/flatten.ts";
import { parseTrace } from "./parser/parser.ts";
import { treeOfTrace } from "./parser/tree.ts";

const fixtures = {
  valid: validTrace,
  partial: partialTrace,
  "broken-links": brokenLinksTrace,
};

type FixtureName = keyof typeof fixtures;

function App() {
  const [fixtureName, setFixtureName] = useState<FixtureName>("valid");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  function selectFixture(name: FixtureName) {
    setFixtureName(name);
    setExpandedIds(new Set());
    setSelectedSpanId(null);
  }

  const result = parseTrace(fixtures[fixtureName]);
  const fixturePicker = (
    <label>
      Пример данных:{" "}
      <select
        value={fixtureName}
        onChange={(event) => selectFixture(event.currentTarget.value as FixtureName)}
      >
        <option value="valid">Корректный trace</option>
        <option value="partial">Частично повреждённый trace</option>
        <option value="broken-links">Ошибки связей</option>
      </select>
    </label>
  );

  if (result.trace === null) {
    return (
      <main id="app">
        {fixturePicker}
        <h1>Не удалось прочитать trace</h1>
        <ul>
          {result.issues.map((issue, index) => (
            <li key={index}>{issue.code}: {issue.detail}</li>
          ))}
        </ul>
      </main>
    );
  }

  const trace = result.trace;
  const tree = treeOfTrace(trace);
  const allIssues = [...result.issues, ...tree.issues];
  const visibleNodes = flattenVisibleTree(tree.roots, expandedIds);

  function toggleExpanded(id: string) {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSpanDetails(id: string) {
    setSelectedSpanId((previous) => previous === id ? null : id);
  }

  function showSpan(id: string) {
    const stack = tree.roots.map((node) => ({ node, parentId: [] as string[] }));

    while (stack.length > 0) {
      const { node, parentId } = stack.pop()!;

      if (node.span.id === id) {
        setExpandedIds((previous) => new Set([...previous, ...parentId]));
        setSelectedSpanId(id);
        return;
      }

      for (const child of node.children) {
        stack.push({ node: child, parentId: [...parentId, node.span.id] });
      }
    }
  }

  return (
    <main id="app">
      {fixturePicker}
      <h1>{trace.name}</h1>
      <p>Spans: {trace.spans.length}</p>
      <p>Корней: {tree.roots.length}</p>
      <p>Проблем: {allIssues.length}</p>

      <section aria-label="Дерево spans">
        {visibleNodes.map((node) => (
          <div key={node.span.id} style={{ paddingLeft: node.depth * 16 }}>
            <span>{node.span.name} — {node.span.kind}, {node.span.status}; {node.subtreeDurationMs} мс</span>{" "}
            {node.containsError && <span>Содержит ошибку </span>}
            {node.children.length > 0 && (
              <button
                type="button"
                aria-expanded={expandedIds.has(node.span.id)}
                onClick={() => toggleExpanded(node.span.id)}
              >
                {expandedIds.has(node.span.id) ? "Свернуть" : "Показать детей"}
              </button>
            )}{" "}
            <button
              type="button"
              aria-pressed={selectedSpanId === node.span.id}
              onClick={() => toggleSpanDetails(node.span.id)}
            >
              {selectedSpanId === node.span.id ? "Скрыть детали" : "Детали"}
            </button>
            {selectedSpanId === node.span.id && (
              <section aria-label={`Подробности span ${node.span.name}`}>
                <h2>{node.span.name}</h2>
                <p>Вид: {node.span.kind}</p>
                <p>Статус: {node.span.status}</p>
                <p>Начало: {node.span.startTime}</p>
                <p>Конец: {node.span.endTime ?? "ещё не завершён"}</p>
              </section>
            )}
          </div>
        ))}
      </section>

      <section aria-label="Проблемы данных">
        <h2>Проблемы данных</h2>
        {allIssues.length === 0 ? (
          <p>Проблем не найдено</p>
        ) : (
          <ul>
            {allIssues.map((issue, index) => {
              const spanId = issue.spanId;
              const hasSpan = spanId !== undefined &&
                trace.spans.some((span) => span.id === spanId);

              return (
                <li key={index}>
                  <strong>{issue.severity}</strong>: {issue.code} — {issue.detail}{" "}
                  {hasSpan && spanId !== undefined && (
                    <button type="button" onClick={() => showSpan(spanId)}>
                      Показать span
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
