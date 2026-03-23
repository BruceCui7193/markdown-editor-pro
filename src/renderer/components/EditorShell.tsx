import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import type { OpenedFolder, ThemeMode } from '@shared/contracts';
import type { DocumentStats, EditorDocumentState } from '../App';
import type { ThemePalette } from '../theme';
import Toolbar from './Toolbar';
import StatusBar from './StatusBar';
import Sidebar from './Sidebar';
import { createEditorExtensions } from '../editor/create-editor-extensions';
import { parseMarkdown, serializeMarkdown, serializeMarkdownFragment } from '../editor/markdown';
import { calculateDocumentStats, fileToBase64 } from '../editor/utils/helpers';
import { extractOutline, type OutlineItem } from '../utils/document';

interface EditorShellProps {
  document: EditorDocumentState;
  folder: OpenedFolder | null;
  theme: ThemeMode;
  themePalette: ThemePalette;
  resolvedTheme: 'light' | 'dark';
  onDocumentChange: (markdown: string, stats: DocumentStats) => void;
  onDocumentMetaChange: (dirty: boolean) => void;
  onOpenDocument: () => void;
  onOpenDocumentPath: (filePath: string) => void;
  onOpenFolder: () => void;
  onSaveDocument: (markdown?: string, stats?: DocumentStats) => Promise<boolean> | boolean;
  onSaveDocumentAs: (markdown?: string, stats?: DocumentStats) => Promise<boolean> | boolean;
  onCreateDocument: () => void;
  onSetTheme: (theme: ThemeMode) => void;
  onSetThemePalette: (palette: ThemePalette) => void;
}

function computeSourceStats(markdown: string): DocumentStats {
  return calculateDocumentStats(markdown);
}

function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return encodeURI(normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F');
}

function resolveImageSource(source: string, documentPath: string | null): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return '';
  }

  if (/^(https?:|data:|blob:|file:)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    return toFileUrl(trimmed);
  }

  if (!documentPath) {
    return trimmed;
  }

  const baseDirectory = documentPath.replace(/\\/g, '/').replace(/\/[^/]*$/, '/');
  return new URL(trimmed, toFileUrl(baseDirectory)).toString();
}

function getEditorPlainText(editor: TiptapEditor): string {
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n');
}

function extractOutlineFromEditor(editor: TiptapEditor): OutlineItem[] {
  const items: OutlineItem[] = [];

  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'heading') {
      return true;
    }

    const text = node.textContent.trim();
    if (!text) {
      return true;
    }

    items.push({
      id: `heading-${position}-${items.length}`,
      level: Number(node.attrs.level ?? 1),
      text,
    });

    return true;
  });

  return items;
}

function areStatsEqual(left: DocumentStats, right: DocumentStats): boolean {
  return (
    left.words === right.words &&
    left.characters === right.characters &&
    left.lines === right.lines
  );
}

function areOutlinesEqual(left: OutlineItem[], right: OutlineItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const next = right[index];
    return item.id === next.id && item.level === next.level && item.text === next.text;
  });
}

type IdleHandle = number;

function scheduleIdleWork(task: () => void, timeout = 1000): IdleHandle {
  return window.setTimeout(task, timeout);
}

function cancelIdleWork(handle: IdleHandle | null): void {
  if (handle === null) {
    return;
  }

  window.clearTimeout(handle);
}

const VISUAL_META_SYNC_DELAY_MS = 260;
const VISUAL_DOCUMENT_SYNC_TIMEOUT_MS = 1400;

interface EditorViewportProps {
  editor: TiptapEditor | null;
  editorHostRef: RefObject<HTMLDivElement | null>;
  sourceMode: boolean;
  sourceDraft: string;
  sourceTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onFrameMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onSourceChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

const EditorViewport = memo(function EditorViewport({
  editor,
  editorHostRef,
  sourceMode,
  sourceDraft,
  sourceTextareaRef,
  onFrameMouseDown,
  onSourceChange,
}: EditorViewportProps) {
  return (
    <div
      className={sourceMode ? 'editor-frame is-source' : 'editor-frame'}
      onMouseDown={onFrameMouseDown}
    >
      {sourceMode ? (
        <textarea
          ref={sourceTextareaRef}
          className="editor-source"
          onChange={onSourceChange}
          spellCheck={false}
          value={sourceDraft}
        />
      ) : (
        <div ref={editorHostRef}>
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
});

export default function EditorShell({
  document,
  folder,
  theme,
  themePalette,
  resolvedTheme,
  onDocumentChange,
  onDocumentMetaChange,
  onOpenDocument,
  onOpenDocumentPath,
  onOpenFolder,
  onSaveDocument,
  onSaveDocumentAs,
  onCreateDocument,
  onSetTheme,
  onSetThemePalette,
}: EditorShellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const initialContentRef = useRef(parseMarkdown(document.markdown));
  const documentPathRef = useRef(document.path);
  const documentMarkdownRef = useRef(document.markdown);
  const visualMarkdownRef = useRef(document.markdown);
  const visualStatsRef = useRef(document.stats);
  const externalUpdateRef = useRef(false);
  const lastEmittedMarkdownRef = useRef(document.markdown);
  const windowDirtyRef = useRef(document.dirty);
  const skipNextDocChangeRef = useRef(true);
  const pendingVisualMetaSyncRef = useRef<number | null>(null);
  const pendingVisualDocumentSyncRef = useRef<IdleHandle | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(() => {
    return window.localStorage.getItem('markdown-editor-toolbar') !== 'hidden';
  });
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    return window.localStorage.getItem('markdown-editor-sidebar') !== 'hidden';
  });
  const [sidebarTab, setSidebarTab] = useState<'files' | 'outline'>('files');
  const [sourceMode, setSourceMode] = useState(() => {
    return window.localStorage.getItem('markdown-editor-source-mode') === 'true';
  });
  const [sourceDraft, setSourceDraft] = useState(document.markdown);
  const [liveStats, setLiveStats] = useState(document.stats);
  const [liveDirty, setLiveDirty] = useState(document.dirty);
  const sourceModeRef = useRef(sourceMode);
  const sourceDraftRef = useRef(sourceDraft);
  const [outline, setOutline] = useState<OutlineItem[]>(() => extractOutline(document.markdown));

  useEffect(() => {
    documentPathRef.current = document.path;
  }, [document.path]);

  useEffect(() => {
    documentMarkdownRef.current = document.markdown;
  }, [document.markdown]);

  useEffect(() => {
    visualMarkdownRef.current = document.markdown;
    visualStatsRef.current = document.stats;
  }, [document.markdown, document.stats]);

  useEffect(() => {
    windowDirtyRef.current = document.dirty;
  }, [document.dirty]);

  useEffect(() => {
    setLiveDirty(document.dirty);
  }, [document.dirty]);

  useEffect(() => {
    setLiveStats((current) => (areStatsEqual(current, document.stats) ? current : document.stats));
  }, [document.stats]);

  useEffect(() => {
    sourceModeRef.current = sourceMode;
  }, [sourceMode]);

  useEffect(() => {
    sourceDraftRef.current = sourceDraft;
  }, [sourceDraft]);

  useEffect(() => {
    if (sourceMode) {
      setSourceDraft(document.markdown);
      const nextStats = computeSourceStats(document.markdown);
      setLiveStats((current) => (areStatsEqual(current, nextStats) ? current : nextStats));
      setLiveDirty(document.dirty);
      const nextOutline = extractOutline(document.markdown);
      setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
      onDocumentMetaChange(document.dirty);
    }
  }, [document.dirty, document.markdown, onDocumentMetaChange, sourceMode]);

  useEffect(() => {
    window.localStorage.setItem('markdown-editor-toolbar', toolbarVisible ? 'visible' : 'hidden');
  }, [toolbarVisible]);

  useEffect(() => {
    window.localStorage.setItem('markdown-editor-sidebar', sidebarVisible ? 'visible' : 'hidden');
  }, [sidebarVisible]);

  useEffect(() => {
    window.localStorage.setItem('markdown-editor-source-mode', sourceMode ? 'true' : 'false');
  }, [sourceMode]);

  const extensions = useMemo(
    () =>
      createEditorExtensions({
        onUploadImage: async (file) => {
          const base64 = await fileToBase64(file);
          const saved = await window.markdownEditor.saveImage({
            base64,
            suggestedName: file.name,
            currentPath: documentPathRef.current,
          });

          return saved.markdownPath;
        },
        onResolveImageSource: (source) => resolveImageSource(source, documentPathRef.current),
      }),
    [],
  );

  const handleClipboardTextSerialize = useCallback(
    (slice: { content: { toJSON: () => unknown } }) => {
      const content = slice.content.toJSON() as Parameters<typeof serializeMarkdownFragment>[0];
      return serializeMarkdownFragment(content).trimEnd();
    },
    [],
  );

  const handleEditorClick = useCallback((_view: unknown, _pos: unknown, event: Event) => {
    const target = event.target as HTMLElement;
    const link = target?.closest('a[href]') as HTMLAnchorElement | null;

    if (link && ('metaKey' in event || 'ctrlKey' in event)) {
      const keyboardLikeEvent = event as Event & { metaKey?: boolean; ctrlKey?: boolean };
      if (!(keyboardLikeEvent.metaKey || keyboardLikeEvent.ctrlKey)) {
        return false;
      }

      void window.markdownEditor.openExternal(link.href);
      return true;
    }

    return false;
  }, []);

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: 'editor-surface',
        spellcheck: 'true',
      },
      clipboardTextSerializer: handleClipboardTextSerialize,
      handleClick: handleEditorClick,
    }),
    [handleClipboardTextSerialize, handleEditorClick],
  );

  const editor = useEditor({
    extensions,
    autofocus: 'end',
    content: initialContentRef.current,
    shouldRerenderOnTransaction: false,
    editorProps,
    onCreate: ({ editor: nextEditor }) => {
      const canonicalMarkdown = serializeMarkdown(nextEditor.getJSON());
      const stats = calculateDocumentStats(getEditorPlainText(nextEditor));
      setLiveStats(stats);
      setLiveDirty(false);
      setOutline(extractOutlineFromEditor(nextEditor));
      visualMarkdownRef.current = canonicalMarkdown;
      visualStatsRef.current = stats;
      lastEmittedMarkdownRef.current = canonicalMarkdown;
      skipNextDocChangeRef.current = true;
    },
    onUpdate: ({ editor: nextEditor, transaction }) => {
      if (externalUpdateRef.current || sourceModeRef.current) {
        return;
      }

      if (!transaction.docChanged) {
        return;
      }

      if (skipNextDocChangeRef.current) {
        skipNextDocChangeRef.current = false;
        const canonicalMarkdown = serializeMarkdown(nextEditor.getJSON());
        const stats = calculateDocumentStats(getEditorPlainText(nextEditor));
        visualMarkdownRef.current = canonicalMarkdown;
        visualStatsRef.current = stats;
        lastEmittedMarkdownRef.current = canonicalMarkdown;
        setLiveDirty(false);
        return;
      }

      if (!windowDirtyRef.current) {
        windowDirtyRef.current = true;
        setLiveDirty(true);
        onDocumentMetaChange(true);
        void window.markdownEditor.setWindowDirty(true);
      }

      if (pendingVisualMetaSyncRef.current !== null) {
        window.clearTimeout(pendingVisualMetaSyncRef.current);
      }

      pendingVisualMetaSyncRef.current = window.setTimeout(() => {
        const stats = calculateDocumentStats(getEditorPlainText(nextEditor));
        setLiveStats((current) => (areStatsEqual(current, stats) ? current : stats));

        if (sidebarVisible && sidebarTab === 'outline') {
          const nextOutline = extractOutlineFromEditor(nextEditor);
          setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
        }

        pendingVisualMetaSyncRef.current = null;
      }, VISUAL_META_SYNC_DELAY_MS);

      if (pendingVisualDocumentSyncRef.current !== null) {
        cancelIdleWork(pendingVisualDocumentSyncRef.current);
      }

      pendingVisualDocumentSyncRef.current = scheduleIdleWork(() => {
        const markdown = serializeMarkdown(nextEditor.getJSON());
        const stats = calculateDocumentStats(getEditorPlainText(nextEditor));
        visualMarkdownRef.current = markdown;
        visualStatsRef.current = stats;
        lastEmittedMarkdownRef.current = markdown;
        pendingVisualDocumentSyncRef.current = null;
      }, VISUAL_DOCUMENT_SYNC_TIMEOUT_MS);
    },
  }, []);

  function flushVisualSync(targetEditor = editor): { markdown: string; stats: DocumentStats } | null {
    if (!targetEditor) {
      return null;
    }

    if (pendingVisualMetaSyncRef.current !== null) {
      window.clearTimeout(pendingVisualMetaSyncRef.current);
      pendingVisualMetaSyncRef.current = null;
    }

    if (pendingVisualDocumentSyncRef.current !== null) {
      cancelIdleWork(pendingVisualDocumentSyncRef.current);
      pendingVisualDocumentSyncRef.current = null;
    }

    const markdown = serializeMarkdown(targetEditor.getJSON());
    const stats = calculateDocumentStats(getEditorPlainText(targetEditor));
    visualMarkdownRef.current = markdown;
    visualStatsRef.current = stats;
    lastEmittedMarkdownRef.current = markdown;
    setLiveStats((current) => (areStatsEqual(current, stats) ? current : stats));
    setLiveDirty(markdown !== document.savedMarkdown);
    onDocumentChange(markdown, stats);
    const nextOutline = extractOutlineFromEditor(targetEditor);
    setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
    return { markdown, stats };
  }

  useEffect(() => {
    return () => {
      if (pendingVisualMetaSyncRef.current !== null) {
        window.clearTimeout(pendingVisualMetaSyncRef.current);
      }

      if (pendingVisualDocumentSyncRef.current !== null) {
        cancelIdleWork(pendingVisualDocumentSyncRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!editor || sourceMode) {
      return;
    }

    if (document.markdown === lastEmittedMarkdownRef.current) {
      return;
    }

    externalUpdateRef.current = true;
    skipNextDocChangeRef.current = true;
    editor.commands.setContent(parseMarkdown(document.markdown), false);
    externalUpdateRef.current = false;
    lastEmittedMarkdownRef.current = document.markdown;
    const nextOutline = extractOutline(document.markdown);
    setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
    const stats = calculateDocumentStats(getEditorPlainText(editor));
    setLiveStats((current) => (areStatsEqual(current, stats) ? current : stats));
    setLiveDirty(document.dirty);
    onDocumentMetaChange(document.dirty);
  }, [document.dirty, document.markdown, editor, onDocumentMetaChange, sourceMode]);

  useEffect(() => {
    if (sourceMode) {
      sourceTextareaRef.current?.focus();
      return;
    }

    requestAnimationFrame(() => {
      if (!editorHostRef.current) {
        return;
      }

      const headings = editorHostRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading, index) => {
        (heading as HTMLElement).dataset.outlineIndex = String(index);
      });
    });
  }, [document.markdown, sourceMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        const visualState = sourceModeRef.current ? null : flushVisualSync();
        if (event.shiftKey) {
          onSaveDocumentAs(
            sourceModeRef.current ? sourceDraftRef.current : visualState?.markdown,
            sourceModeRef.current ? computeSourceStats(sourceDraftRef.current) : visualState?.stats,
          );
        } else {
          onSaveDocument(
            sourceModeRef.current ? sourceDraftRef.current : visualState?.markdown,
            sourceModeRef.current ? computeSourceStats(sourceDraftRef.current) : visualState?.stats,
          );
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'e') {
        event.preventDefault();
        setSourceMode((current) => {
          if (!current) {
            const visualState = flushVisualSync();
            setSourceDraft(visualState?.markdown ?? documentMarkdownRef.current);
          }
          return !current;
        });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'b') {
        event.preventDefault();
        setToolbarVisible((current) => !current);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === '\\') {
        event.preventDefault();
        setSidebarVisible((current) => !current);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSaveDocument, onSaveDocumentAs]);

  useEffect(() => {
    return window.markdownEditor.onRequestSaveBeforeClose(() => {
      void (async () => {
        const visualState = sourceModeRef.current ? null : flushVisualSync();
        const saved = await onSaveDocument(
          sourceModeRef.current ? sourceDraftRef.current : visualState?.markdown,
          sourceModeRef.current ? computeSourceStats(sourceDraftRef.current) : visualState?.stats,
        );
        window.markdownEditor.respondSaveBeforeClose(Boolean(saved));
      })();
    });
  }, [onSaveDocument, editor]);

  useEffect(() => {
    const handler = (event: Event) => {
      const menuEvent = event as CustomEvent<
        'save-document' | 'save-document-as' | 'toggle-source-mode' | 'toggle-toolbar' | 'toggle-sidebar'
      >;
      if (menuEvent.detail === 'save-document') {
        const visualState = sourceModeRef.current ? null : flushVisualSync();
        void onSaveDocument(
          sourceModeRef.current ? sourceDraftRef.current : visualState?.markdown,
          sourceModeRef.current ? computeSourceStats(sourceDraftRef.current) : visualState?.stats,
        );
        return;
      }

      if (menuEvent.detail === 'save-document-as') {
        const visualState = sourceModeRef.current ? null : flushVisualSync();
        void onSaveDocumentAs(
          sourceModeRef.current ? sourceDraftRef.current : visualState?.markdown,
          sourceModeRef.current ? computeSourceStats(sourceDraftRef.current) : visualState?.stats,
        );
        return;
      }

      if (menuEvent.detail === 'toggle-source-mode') {
        setSourceMode((current) => {
          if (!current) {
            const visualState = flushVisualSync();
            setSourceDraft(visualState?.markdown ?? documentMarkdownRef.current);
          }
          return !current;
        });
        return;
      }

      if (menuEvent.detail === 'toggle-toolbar') {
        setToolbarVisible((current) => !current);
        return;
      }

      if (menuEvent.detail === 'toggle-sidebar') {
        setSidebarVisible((current) => !current);
      }
    };

    window.addEventListener('markdown-editor:menu-action', handler as EventListener);
    return () => {
      window.removeEventListener('markdown-editor:menu-action', handler as EventListener);
    };
  }, []);

  const handleFrameMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (sourceMode) {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          sourceTextareaRef.current?.focus();
          const target = sourceTextareaRef.current;
          if (target) {
            const caret = target.value.length;
            target.setSelectionRange(caret, caret);
          }
        }
        return;
      }

      if (event.target === event.currentTarget || event.target === editorHostRef.current) {
        event.preventDefault();
        editor?.chain().focus('end').run();
      }
    },
    [editor, sourceMode],
  );

  const handleSourceChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const markdown = event.target.value;
      const nextStats = computeSourceStats(markdown);
      setSourceDraft(markdown);
      lastEmittedMarkdownRef.current = markdown;
      setLiveStats((current) => (areStatsEqual(current, nextStats) ? current : nextStats));
      setLiveDirty(markdown !== document.savedMarkdown);
      onDocumentChange(markdown, nextStats);
      const nextOutline = extractOutline(markdown);
      setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
      onDocumentMetaChange(markdown !== document.savedMarkdown);
    },
    [document.savedMarkdown, onDocumentChange, onDocumentMetaChange],
  );

  const handleToolbarSave = useCallback(() => {
    const visualState = sourceModeRef.current ? null : flushVisualSync();
    void onSaveDocument(
      sourceModeRef.current ? sourceDraftRef.current : visualState?.markdown,
      sourceModeRef.current ? computeSourceStats(sourceDraftRef.current) : visualState?.stats,
    );
  }, [document.savedMarkdown, onSaveDocument, editor]);

  const handleToolbarSaveAs = useCallback(() => {
    const visualState = sourceModeRef.current ? null : flushVisualSync();
    void onSaveDocumentAs(
      sourceModeRef.current ? sourceDraftRef.current : visualState?.markdown,
      sourceModeRef.current ? computeSourceStats(sourceDraftRef.current) : visualState?.stats,
    );
  }, [document.savedMarkdown, onSaveDocumentAs, editor]);

  const handleInsertImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible((current) => !current);
  }, []);

  const handleToggleToolbar = useCallback(() => {
    setToolbarVisible((current) => !current);
  }, []);

  const handleToggleSourceMode = useCallback(() => {
    setSourceMode((current) => {
      if (!current) {
        const visualState = flushVisualSync();
        setSourceDraft(visualState?.markdown ?? documentMarkdownRef.current);
      }
      return !current;
    });
  }, [editor]);

  const handleNavigateOutline = useCallback(
    (index: number) => {
      setSidebarTab('outline');

      if (sourceModeRef.current) {
        return;
      }

      const target = editorHostRef.current?.querySelector(
        `[data-outline-index="${index}"]`,
      ) as HTMLElement | null;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [],
  );

  return (
    <div className="app-shell" data-theme={resolvedTheme} data-color-scheme={themePalette}>
      <Toolbar
        editor={editor}
        onInsertImage={handleInsertImage}
        onNewWindow={onCreateDocument}
        onOpen={onOpenDocument}
        onOpenFolder={onOpenFolder}
        onSave={handleToolbarSave}
        onSaveAs={handleToolbarSaveAs}
        onToggleSidebar={handleToggleSidebar}
        onToggleSourceMode={handleToggleSourceMode}
        onToggleToolbar={handleToggleToolbar}
        sidebarVisible={sidebarVisible}
        sourceMode={sourceMode}
        theme={theme}
        themePalette={themePalette}
        toolbarVisible={toolbarVisible}
        onSetTheme={onSetTheme}
        onSetThemePalette={onSetThemePalette}
      />

      <main className={sidebarVisible ? 'workspace workspace--with-sidebar' : 'workspace workspace--single'}>
        <Sidebar
          currentFilePath={document.path}
          folderEntries={folder?.entries ?? []}
          folderPath={folder?.path ?? null}
          onNavigateOutline={handleNavigateOutline}
          onOpenFile={(filePath) => onOpenDocumentPath(filePath)}
          onOpenFolder={onOpenFolder}
          onSelectTab={setSidebarTab}
          outline={outline}
          tab={sidebarTab}
          visible={sidebarVisible}
        />

        <EditorViewport
          editor={editor}
          editorHostRef={editorHostRef}
          onFrameMouseDown={handleFrameMouseDown}
          onSourceChange={handleSourceChange}
          sourceDraft={sourceDraft}
          sourceMode={sourceMode}
          sourceTextareaRef={sourceTextareaRef}
        />
      </main>

      <StatusBar
        dirty={liveDirty}
        lastSavedAt={document.lastSavedAt}
        stats={liveStats}
        title={document.title}
      />

      <input
        accept="image/*"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          const base64 = await fileToBase64(file);
          const saved = await window.markdownEditor.saveImage({
            base64,
            suggestedName: file.name,
            currentPath: documentPathRef.current,
          });

          if (sourceMode) {
            const insertion = `![${file.name}](${saved.markdownPath})`;
            const currentValue = sourceDraft;
            const input = sourceTextareaRef.current;
            const start = input?.selectionStart ?? currentValue.length;
            const end = input?.selectionEnd ?? currentValue.length;
            const markdown = `${currentValue.slice(0, start)}${insertion}${currentValue.slice(end)}`;
            setSourceDraft(markdown);
            lastEmittedMarkdownRef.current = markdown;
            setLiveStats((current) => {
              const nextStats = computeSourceStats(markdown);
              return areStatsEqual(current, nextStats) ? current : nextStats;
            });
            setLiveDirty(markdown !== document.savedMarkdown);
            onDocumentChange(markdown, computeSourceStats(markdown));
            const nextOutline = extractOutline(markdown);
            setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
            onDocumentMetaChange(markdown !== document.savedMarkdown);
            event.target.value = '';
            return;
          }

          if (!editor) {
            return;
          }

          editor.chain().focus().setImage({ src: saved.markdownPath, alt: '', title: null }).run();
          event.target.value = '';
        }}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}
