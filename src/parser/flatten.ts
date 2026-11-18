import type { TraceNode } from "../types/trace";

//функция получающая корни дерева и ID раскрытых узлов, возвращает TraceNode[]
export function flattenVisibleTree(
   roots: TraceNode[],
   expandedId: ReadonlySet<string>,
): TraceNode[] {
   const visible: TraceNode[] = [];

   function visit(node: TraceNode): void {
      visible.push(node)

      if (!expandedId.has(node.span.id)) return;

      for (const child of node.children) {
         visit(child)
      }
   }

   for (const root of roots) {
      visit(root)
   }
   return visible;
}
