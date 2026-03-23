import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export default function FootnoteDefinitionView({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper className="footnote-definition-node">
      <div className="footnote-definition-node__meta" contentEditable={false}>
        <span>{`[^${node.attrs.label}]`}</span>
        <button
          onClick={() => {
            const nextLabel = window.prompt('\u811a\u6ce8\u7f16\u53f7', String(node.attrs.label ?? '1'));
            if (!nextLabel) {
              return;
            }

            updateAttributes({ label: nextLabel });
          }}
          type="button"
        >
          {'\u91cd\u547d\u540d'}
        </button>
      </div>
      <NodeViewContent className="footnote-definition-node__content" />
    </NodeViewWrapper>
  );
}
