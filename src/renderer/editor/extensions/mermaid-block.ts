import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MermaidBlockView from '../node-views/MermaidBlockView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      insertMermaidBlock: (code?: string) => ReturnType;
    };
  }
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      code: {
        default: 'graph TD\n  A[Idea] --> B[Ship]',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'mermaid-block',
        'data-code': node.attrs.code,
      }),
      node.attrs.code,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView, {
      update: ({ oldNode, newNode, updateProps }) => {
        if (oldNode.type !== newNode.type) {
          return false;
        }

        if (oldNode.attrs.code === newNode.attrs.code) {
          return true;
        }

        updateProps();
        return true;
      },
    });
  },

  addCommands() {
    return {
      insertMermaidBlock:
        (code = 'graph TD\n  A[Idea] --> B[Ship]') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { code },
          }),
    };
  },
});
