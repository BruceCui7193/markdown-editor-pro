import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MathBlockView from '../node-views/MathBlockView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      insertMathBlock: (value?: string) => ReturnType;
    };
  }
}

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      value: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'math-block',
        'data-value': node.attrs.value,
      }),
      node.attrs.value,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView, {
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
      insertMathBlock:
        (value = '') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { value },
          }),
    };
  },
});
