import { useEffect, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

let renderIndex = 0;
let mermaidLoader: Promise<typeof import('mermaid')> | null = null;

function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === 'dark';
}

function loadMermaid() {
  mermaidLoader ??= import('mermaid');
  return mermaidLoader;
}

export default function MermaidBlockView({ node, selected, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.code);
  const [draft, setDraft] = useState(String(node.attrs.code ?? ''));
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const editorHeight = Math.max(220, draft.split('\n').length * 28 + 28);

  useEffect(() => {
    setDraft(String(node.attrs.code ?? ''));
  }, [node.attrs.code]);

  useEffect(() => {
    let cancelled = false;
    const source = String(editing ? draft : node.attrs.code ?? '');

    const renderDiagram = async () => {
      try {
        const mermaid = await loadMermaid();

        mermaid.default.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: isDarkTheme() ? 'dark' : 'base',
          fontFamily: 'inherit',
        });
        const id = `mermaid-editor-${renderIndex++}`;
        const result = await mermaid.default.render(id, source);
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : '\u004d\u0065\u0072\u006d\u0061\u0069\u0064 \u6e32\u67d3\u5931\u8d25',
          );
        }
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [draft, editing, node.attrs.code]);

  return (
    <NodeViewWrapper
      className={`mermaid-node ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}
      onClick={(event) => {
        if (!editing && !(event.target as HTMLElement).closest('.mermaid-node__editor')) {
          setEditing(true);
        }
      }}
    >
      {editing ? (
        <div className="mermaid-node__editor">
          <textarea
            autoFocus
            className="node-card__textarea"
            style={{ height: `${editorHeight}px` }}
            onBlur={() => {
              updateAttributes({ code: draft });
              setEditing(false);
            }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                updateAttributes({ code: draft });
                setEditing(false);
              }

              if (event.key === 'Escape') {
                setDraft(String(node.attrs.code ?? ''));
                setEditing(false);
              }
            }}
            spellCheck={false}
            value={draft}
          />
          {error ? (
            <div className="node-card__error">{error}</div>
          ) : (
            <div className="mermaid-node__preview" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
        </div>
      ) : error ? (
        <div className="node-card__error">{error}</div>
      ) : (
        <div className="mermaid-node__preview" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </NodeViewWrapper>
  );
}
