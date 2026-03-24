import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

let katexLoader: Promise<typeof import('katex')> | null = null;

function loadKatex() {
  katexLoader ??= import('katex');
  return katexLoader;
}

function MathBlockView({ getPos, node, selected, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.value);
  const [draft, setDraft] = useState(String(node.attrs.value ?? ''));
  const [katexModule, setKatexModule] = useState<typeof import('katex') | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(customEvent.detail.start, customEvent.detail.end);
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
      className={`math-block-node ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}
      onClick={() => {
        if (!editing) {
          setEditing(true);
        }
      }}
      ref={wrapperRef}
    >
      {editing ? (
        <div className="math-block-editor">
          <textarea
            autoFocus
            className="math-block-editor__textarea"
            onBlur={commitDraft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                commitDraft();
              }

              if (event.key === 'Escape') {
                setDraft(String(node.attrs.value ?? ''));
                setEditing(false);
              }
            }}
            ref={textareaRef}
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
