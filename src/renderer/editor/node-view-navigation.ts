import type { Editor } from '@tiptap/core';
import type { KeyboardEvent } from 'react';
import { moveCursorAroundBlockNode } from './block-node-cursor';

export type NodeViewPosition = (() => number) | boolean;

export function resolveNodeViewPosition(getPos: NodeViewPosition): number | null {
  try {
    return typeof getPos === 'function' ? getPos() : null;
  } catch {
    return null;
  }
}

interface BoundaryNavigationOptions<ElementType extends HTMLInputElement | HTMLTextAreaElement> {
  editor: Editor;
  event: KeyboardEvent<ElementType>;
  getPos: NodeViewPosition;
  nodeSize: number;
  textLength: number;
  commit: () => void;
}

export function handleBlockEditorBoundaryNavigation<ElementType extends HTMLInputElement | HTMLTextAreaElement>({
  editor,
  event,
  getPos,
  nodeSize,
  textLength,
  commit,
}: BoundaryNavigationOptions<ElementType>): boolean {
  const selectionStart = event.currentTarget.selectionStart ?? 0;
  const selectionEnd = event.currentTarget.selectionEnd ?? 0;
  if (selectionStart !== selectionEnd) {
    return false;
  }

  const position = resolveNodeViewPosition(getPos);
  if (position === null) {
    return false;
  }

  if (event.key === 'ArrowLeft' && selectionStart === 0) {
    event.preventDefault();
    commit();
    return moveCursorAroundBlockNode(editor, position, nodeSize, 'before');
  }

  if (event.key === 'ArrowRight' && selectionEnd === textLength) {
    event.preventDefault();
    commit();
    return moveCursorAroundBlockNode(editor, position, nodeSize, 'after');
  }

  return false;
}

export function handleInlineEditorBoundaryNavigation<ElementType extends HTMLInputElement | HTMLTextAreaElement>({
  editor,
  event,
  getPos,
  nodeSize,
  textLength,
  commit,
}: BoundaryNavigationOptions<ElementType>): boolean {
  const selectionStart = event.currentTarget.selectionStart ?? 0;
  const selectionEnd = event.currentTarget.selectionEnd ?? 0;
  if (selectionStart !== selectionEnd) {
    return false;
  }

  const position = resolveNodeViewPosition(getPos);
  if (position === null) {
    return false;
  }

  if (event.key === 'ArrowLeft' && selectionStart === 0) {
    event.preventDefault();
    commit();
    editor.chain().focus(position).run();
    return true;
  }

  if (event.key === 'ArrowRight' && selectionEnd === textLength) {
    event.preventDefault();
    commit();
    editor.chain().focus(position + nodeSize).run();
    return true;
  }

  return false;
}
