import type { JSONContent } from '@tiptap/core';
import { parseMarkdown } from './markdown';
import { extractOutline, type OutlineItem } from '../utils/document';

interface ParseMarkdownRequest {
  id: number;
  markdown: string;
}

interface ParseMarkdownSuccess {
  id: number;
  ok: true;
  content: JSONContent;
  outline: OutlineItem[];
}

interface ParseMarkdownFailure {
  id: number;
  ok: false;
  error: string;
}

type ParseMarkdownResponse = ParseMarkdownSuccess | ParseMarkdownFailure;

self.onmessage = (event: MessageEvent<ParseMarkdownRequest>) => {
  const { id, markdown } = event.data;

  try {
    const content = parseMarkdown(markdown);
    const outline = extractOutline(markdown);
    const response: ParseMarkdownResponse = {
      id,
      ok: true,
      content,
      outline,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ParseMarkdownResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Markdown parse failed',
    };
    self.postMessage(response);
  }
};
