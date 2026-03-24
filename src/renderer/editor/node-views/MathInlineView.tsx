import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

let katexLoader: Promise<typeof import('katex')> | null = null;

function loadKatex() {
  katexLoader ??= import('katex');
  return katexLoader;
}

function MathInlineView({ getPos, node, selected, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.value);
  const [draft, setDraft] = useState(String(node.attrs.value ?? ''));
  const [katexModule, setKatexModule] = useState<typeof import('katex') | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const commitDraft = useCallback(() => {
    updateAttributes({ value: draft });
    setEditing(false);
  }, [draft, updateAttributes]);

  useEffect(() => {
    if (!editing) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (wrapperRef.current?.contains(target)) {
        return;
      }

      commitDraft();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [commitDraft, editing]);

  useEffect(() => {
    const handleFocusMatch = (event: Event) => {
      const customEvent = event as CustomEvent<{ pos: number; start: number; end: number }>;
      let position: number | null = null;

      try {
        position = typeof getPos === 'function' ? getPos() : null;
      } catch {
        position = null;
      }

      if (position === null || position !== customEvent.detail.pos) {
        return;
      }

      setEditing(true);
      setDraft(String(node.attrs.value ?? ''));

      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(customEvent.detail.start, customEvent.detail.end);
      });
    };

    window.addEventListener('markdown-editor:focus-math-search-match', handleFocusMatch as EventListener);
    return () => {
      window.removeEventListener(
        'markdown-editor:focus-math-search-match',
        handleFocusMatch as EventListener,
      );
    };
  }, [getPos, node.attrs.value]);

  return (
    <NodeViewWrapper
      as="span"
      className={`math-inline-node ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}
      onClick={() => {
        if (!editing) {
          setEditing(true);
        }
      }}
      ref={wrapperRef}
    >
      {editing ? (
        <span className="math-inline-editor">
          <input
            autoFocus
            className="math-inline-node__input"
            onBlur={commitDraft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitDraft();
              }
              if (event.key === 'Escape') {
                setDraft(String(node.attrs.value ?? ''));
                setEditing(false);
              }
            }}
            ref={inputRef}
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

export default memo(MathInlineView, (prevProps, nextProps) => {
  return (
    prevProps.selected === nextProps.selected &&
    prevProps.node.attrs.value === nextProps.node.attrs.value
  );
});
