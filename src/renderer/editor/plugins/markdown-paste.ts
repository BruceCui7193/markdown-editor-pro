import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { convertHtmlToMarkdown, looksLikeStructuredHtml } from '../html-to-markdown';
import { parseMarkdownFragment } from '../markdown';

function hasMarkdownListStructure(text: string): boolean {
  const bulletMatches = text.match(/^(?:[-*+])\s+\S.+$/gm) ?? [];
  if (bulletMatches.length >= 2) {
    return true;
  }

  const orderedMatches = text.match(/^\d+\.\s+\S.+$/gm) ?? [];
  return orderedMatches.length >= 2;
}

function hasExclusiveMarkdownStructure(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return [
    /^#{1,6}\s+/m,
    /^>\s+/m,
    /^```[\s\S]*```$/m,
    /^~~~[\s\S]*~~~$/m,
    /!\[[^\]]*]\([^)]+\)/,
    /\[[^\]]+]\([^)]+\)/,
    /^\|.+\|$/m,
    /^\[\^[^\]]+]:/m,
  ].some((pattern) => pattern.test(trimmed));
}

function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (hasExclusiveMarkdownStructure(trimmed) || hasMarkdownListStructure(trimmed)) {
    return true;
  }

  return [/\\\([\s\S]+\\\)/, /\\\[[\s\S]+\\\]/, /\$[^$\n]+\$/].some((pattern) =>
    pattern.test(trimmed),
  );
}

function parseContentFromMarkdown(markdown: string) {
  if (!markdown.trim()) {
    return null;
  }

  const content = parseMarkdownFragment(markdown);
  return content.length > 0 ? content : null;
}

function insertPlainTextFallback(text: string) {
  return parseContentFromMarkdown(text.replace(/\r\n/g, '\n'));
}

export function createMarkdownPasteExtension() {
  return Extension.create({
    name: 'markdownPaste',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handlePaste: (_view, event) => {
              const imageFiles = Array.from(event.clipboardData?.files ?? []).filter((file) =>
                file.type.startsWith('image/'),
              );
              if (imageFiles.length > 0) {
                return false;
              }

              const text = event.clipboardData?.getData('text/plain') ?? '';
              const html = event.clipboardData?.getData('text/html') ?? '';
              const hasStructuredHtml = looksLikeStructuredHtml(html);
              const hasExclusiveMarkdown = hasExclusiveMarkdownStructure(text);

              if (hasStructuredHtml && !hasExclusiveMarkdown) {
                const content =
                  parseContentFromMarkdown(convertHtmlToMarkdown(html)) ??
                  insertPlainTextFallback(text);
                if (!content) {
                  return false;
                }

                event.preventDefault();
                this.editor.commands.insertContent(content);
                return true;
              }

              if (looksLikeMarkdown(text)) {
                const content = parseContentFromMarkdown(text);
                if (!content) {
                  return false;
                }

                event.preventDefault();
                this.editor.commands.insertContent(content);
                return true;
              }

              if (hasStructuredHtml) {
                const content =
                  parseContentFromMarkdown(convertHtmlToMarkdown(html)) ??
                  insertPlainTextFallback(text);
                if (!content) {
                  return false;
                }

                event.preventDefault();
                this.editor.commands.insertContent(content);
                return true;
              }

              return false;
            },
          },
        }),
      ];
    },
  });
}
