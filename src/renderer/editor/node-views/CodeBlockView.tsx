import { useEffect, useMemo, useState } from 'react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { CODE_LANGUAGE_OPTIONS } from '../code-languages';

export default function CodeBlockView({ getPos, node, updateAttributes }: NodeViewProps) {
  const [languageDraft, setLanguageDraft] = useState(String(node.attrs.language ?? ''));
  const datalistId = useMemo(() => {
    let suffix = 'fallback';

    try {
      suffix = typeof getPos === 'function' ? String(getPos()) : suffix;
    } catch {
      suffix = 'fallback';
    }

    return `code-block-language-options-${suffix}`;
  }, [getPos]);

  useEffect(() => {
    setLanguageDraft(String(node.attrs.language ?? ''));
  }, [node.attrs.language]);

  const commitLanguage = () => {
    updateAttributes({
      language: languageDraft.trim() || null,
    });
  };

  return (
    <NodeViewWrapper
      className={node.attrs.language ? 'code-block-node has-language' : 'code-block-node'}
      data-language={String(node.attrs.language ?? '').trim() || undefined}
    >
      <NodeViewContent as="pre" className="code-block-node__pre" />
      <div className="code-block-node__toolbar" contentEditable={false}>
        <span className="code-block-node__toolbar-label">Lang</span>
        <input
          className="code-block-node__language-input"
          list={datalistId}
          onBlur={commitLanguage}
          onChange={(event) => setLanguageDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitLanguage();
              (event.target as HTMLInputElement).blur();
            }
          }}
          placeholder="e.g. ts / python / mermaid"
          spellCheck={false}
          type="text"
          value={languageDraft}
        />
        <datalist id={datalistId}>
          {CODE_LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value || 'plain'} value={option.value}>
              {option.label}
            </option>
          ))}
        </datalist>
      </div>
    </NodeViewWrapper>
  );
}
