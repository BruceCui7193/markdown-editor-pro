import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { moveCursorAroundBlockNode } from '../block-node-cursor';
import CodeBlockView from '../node-views/CodeBlockView';

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView, {
      contentDOMElementTag: 'code',
    });
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      ArrowLeft: () => {
        const { selection } = this.editor.state;
        const { $from } = selection;

        if (!selection.empty || $from.parent.type.name !== this.name || $from.parentOffset !== 0) {
          return false;
        }

        return moveCursorAroundBlockNode(this.editor, $from.before($from.depth), $from.parent.nodeSize, 'before');
      },
      ArrowRight: () => {
        const { selection } = this.editor.state;
        const { $from } = selection;

        if (
          !selection.empty ||
          $from.parent.type.name !== this.name ||
          $from.parentOffset !== $from.parent.content.size
        ) {
          return false;
        }

        return moveCursorAroundBlockNode(this.editor, $from.before($from.depth), $from.parent.nodeSize, 'after');
      },
    };
  },
});
