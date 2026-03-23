import { memo, useEffect, useMemo, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

let katexLoader: Promise<typeof import('katex')> | null = null;

function loadKatex() {
  katexLoader ??= import('katex');
  return katexLoader;
}

function MathBlockView({ node, selected, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.value);
  const [draft, setDraft] = useState(String(node.attrs.value ?? ''));
  const [katexModule, setKatexModule] = useState<typeof import('katex') | null>(null);

  useEffect(() => {
    setDraft(String(node.attrs.value ?? ''));
  }, [node.attrs.value]);

  useEffect(() => {
    let active = true;

    void loadKatex().then((module) => {
      if (active) {
        setKatexModule(module);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const preview = useMemo(() => {
    if (!katexModule) {
      return String(editing ? draft : node.attrs.value ?? '');
    }

    return katexModule.default.renderToString(String(editing ? draft : node.attrs.value ?? ''), {
      displayMode: true,
      throwOnError: false,
      strict: 'ignore',
    });
  }, [draft, editing, katexModule, node.attrs.value]);

  return (
    <NodeViewWrapper
      className={`math-block-node ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <div className="math-block-editor">
          <textarea
            autoFocus
            className="math-block-editor__textarea"
            onBlur={() => {
              updateAttributes({ value: draft });
              setEditing(false);
            }}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            value={draft}
          />
          <div className="math-block-editor__preview" dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      ) : (
        <div className="math-block-node__preview" dangerouslySetInnerHTML={{ __html: preview }} />
      )}
    </NodeViewWrapper>
  );
}

export default memo(MathBlockView, (prevProps, nextProps) => {
  return (
    prevProps.selected === nextProps.selected &&
    prevProps.node.attrs.value === nextProps.node.attrs.value
  );
});
