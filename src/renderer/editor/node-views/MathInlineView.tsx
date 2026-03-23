import { useEffect, useMemo, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

let katexLoader: Promise<typeof import('katex')> | null = null;

function loadKatex() {
  katexLoader ??= import('katex');
  return katexLoader;
}

export default function MathInlineView({ node, selected, updateAttributes }: NodeViewProps) {
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
      displayMode: false,
      throwOnError: false,
      strict: 'ignore',
    });
  }, [draft, editing, katexModule, node.attrs.value]);

  return (
    <NodeViewWrapper
      as="span"
      className={`math-inline-node ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <span className="math-inline-editor">
          <input
            autoFocus
            className="math-inline-node__input"
            onBlur={() => {
              updateAttributes({ value: draft });
              setEditing(false);
            }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                updateAttributes({ value: draft });
                setEditing(false);
              }
              if (event.key === 'Escape') {
                setDraft(String(node.attrs.value ?? ''));
                setEditing(false);
              }
            }}
            spellCheck={false}
            type="text"
            value={draft}
          />
          <span className="math-inline-editor__preview" dangerouslySetInnerHTML={{ __html: preview }} />
        </span>
      ) : (
        <span className="math-inline-node__preview" dangerouslySetInnerHTML={{ __html: preview }} />
      )}
    </NodeViewWrapper>
  );
}
