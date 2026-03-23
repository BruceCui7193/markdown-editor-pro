import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnoteReference: {
      insertFootnoteReference: (label?: string) => ReturnType;
    };
  }
}

export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: {
        default: '1',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-type="footnote-reference"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'footnote-reference',
        'data-label': node.attrs.label,
        class: 'footnote-reference',
      }),
      `[^${node.attrs.label}]`,
    ];
  },

  addCommands() {
    return {
      insertFootnoteReference:
        (label = '1') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { label },
          }),
    };
  },
});
