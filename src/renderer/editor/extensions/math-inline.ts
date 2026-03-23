import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MathInlineView from '../node-views/MathInlineView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: {
      insertInlineMath: (value?: string) => ReturnType;
    };
  }
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      value: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'math-inline',
        'data-value': node.attrs.value,
      }),
      node.attrs.value,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView, {
      update: ({ oldNode, newNode, updateProps }) => {
        if (oldNode.type !== newNode.type) {
          return false;
        }

        if (oldNode.attrs.value === newNode.attrs.value) {
          return true;
        }

        updateProps();
        return true;
      },
    });
  },

  addCommands() {
    return {
      insertInlineMath:
        (value = '') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { value },
          }),
    };
  },
});
