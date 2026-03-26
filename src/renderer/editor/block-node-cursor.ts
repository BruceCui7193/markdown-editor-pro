import type { Editor } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';

export type BlockCursorDirection = 'before' | 'after';

export function moveCursorAroundBlockNode(
  editor: Editor,
  nodePos: number,
  nodeSize: number,
  direction: BlockCursorDirection,
): boolean {
  const { state, view } = editor;
  const boundaryPos = direction === 'before' ? nodePos : nodePos + nodeSize;
  const $boundaryPos = state.doc.resolve(boundaryPos);
  const parent = $boundaryPos.parent;
  const index = $boundaryPos.index();
  const adjacentNode =
    direction === 'before'
      ? index > 0
        ? parent.child(index - 1)
        : null
      : index < parent.childCount
        ? parent.child(index)
        : null;

  let tr = state.tr;

  if (adjacentNode?.isTextblock) {
    tr = tr.setSelection(Selection.near(tr.doc.resolve(boundaryPos), direction === 'before' ? -1 : 1));
  } else {
    const paragraphNode = state.schema.nodes.paragraph?.create();
    if (!paragraphNode) {
      return false;
    }

    tr = tr.insert(boundaryPos, paragraphNode);
    tr = tr.setSelection(TextSelection.create(tr.doc, boundaryPos + 1));
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export function deleteBlockNodeAndFocus(editor: Editor, nodePos: number, nodeSize: number): boolean {
  const { state, view } = editor;
  const $nodePos = state.doc.resolve(nodePos);
  const paragraphNode = state.schema.nodes.paragraph?.create();
  let tr = state.tr;

  if ($nodePos.parent.childCount === 1) {
    if (!paragraphNode) {
      return false;
    }

    tr = tr.replaceWith(nodePos, nodePos + nodeSize, paragraphNode);
    tr = tr.setSelection(TextSelection.create(tr.doc, nodePos + 1));
  } else {
    tr = tr.delete(nodePos, nodePos + nodeSize);
    const focusPos = Math.min(nodePos, tr.doc.content.size);
    tr = tr.setSelection(Selection.near(tr.doc.resolve(focusPos), $nodePos.index() > 0 ? -1 : 1));
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
