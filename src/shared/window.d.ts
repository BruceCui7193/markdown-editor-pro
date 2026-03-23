import type { MarkdownEditorApi } from './contracts';

declare global {
  interface Window {
    markdownEditor: MarkdownEditorApi;
  }
}

export {};
