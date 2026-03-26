import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import CodeBlockView from '../node-views/CodeBlockView';

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView, {
      contentDOMElementTag: 'code',
    });
  },
});
