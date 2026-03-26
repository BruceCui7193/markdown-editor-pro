import { InputRule, mergeAttributes, Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
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
        ({ state, tr, dispatch }) => {
          const mathNode = state.schema.nodes.mathBlock?.create({ value });
          if (!mathNode) {
            return false;
          }

          const paragraphNode = state.schema.nodes.paragraph?.create();
          if (!paragraphNode) {
            return false;
          }

          const { from, to } = state.selection;
          tr = tr.replaceWith(from, to, mathNode);

          const paragraphPos = from + mathNode.nodeSize;
          tr = tr.insert(paragraphPos, paragraphNode);
          tr = tr.setSelection(TextSelection.create(tr.doc, paragraphPos + 1));

          if (dispatch) {
            dispatch(tr.scrollIntoView());
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        if (!selection.empty || $from.parent.type.name !== 'paragraph') {
          return false;
        }

        if ($from.parent.textContent.trim() !== '$$') {
          return false;
        }

        const from = $from.before();
        const to = from + $from.parent.nodeSize;

        return this.editor.commands.command(({ tr, dispatch }) => {
          const node = state.schema.nodes.mathBlock?.create({ value: '' });
          if (!node) {
            return false;
          }

          if (dispatch) {
            dispatch(tr.replaceWith(from, to, node).scrollIntoView());
          }

          return true;
        });
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$([^\n]+)\$\$$/,
        handler: ({ chain, range, match }) => {
          const value = String(match[1] ?? '').trim();
          if (!value) {
            return;
          }

          chain()
            .deleteRange(range)
            .insertContent({
              type: this.name,
              attrs: { value },
            })
            .run();
        },
      }),
      new InputRule({
        find: /^\\\[([^\n]+)\\\]$/,
        handler: ({ chain, range, match }) => {
          const value = String(match[1] ?? '').trim();
          if (!value) {
            return;
          }

          chain()
            .deleteRange(range)
            .insertContent({
              type: this.name,
              attrs: { value },
            })
            .run();
        },
      }),
    ];
  },
});
