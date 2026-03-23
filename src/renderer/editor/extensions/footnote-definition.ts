import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FootnoteDefinitionView from '../node-views/FootnoteDefinitionView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnoteDefinition: {
      insertFootnoteDefinition: (label?: string) => ReturnType;
    };
  }
}

export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      label: {
        default: '1',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="footnote-definition"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'footnote-definition',
        'data-label': node.attrs.label,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteDefinitionView);
  },

  addCommands() {
    return {
      insertFootnoteDefinition:
        (label = '1') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { label },
            content: [{ type: 'paragraph' }],
          }),
    };
  },
});
