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
import type { JSONContent } from '@tiptap/core';
import type { OpenedFolder, ThemeMode } from '@shared/contracts';
import type { DocumentStats, EditorDocumentState } from '../App';
import type { ThemePalette } from '../theme';
import Toolbar from './Toolbar';
import StatusBar from './StatusBar';
import Sidebar from './Sidebar';
import { createEditorExtensions } from '../editor/create-editor-extensions';
import { parseMarkdown, serializeMarkdown, serializeMarkdownFragment } from '../editor/markdown';
import {
  findSourceSearchMatches,
  findVisualSearchMatches,
  replaceAllSourceSearchMatches,
  replaceAllVisualSearchMatches,
  replaceSourceSearchMatch,
  replaceVisualSearchMatch,
  selectVisualSearchMatch,
  type SourceSearchMatch,
  type VisualSearchMatch,
} from '../editor/search';
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

interface WorkerParseSuccess {
  id: number;
  ok: true;
  content: JSONContent;
  outline: OutlineItem[];
}

interface WorkerParseFailure {
  id: number;
  ok: false;
  error: string;
}

type WorkerParseResponse = WorkerParseSuccess | WorkerParseFailure;

function createEmptyDocument(): JSONContent {
  return {
    type: 'doc',
    content: [],
  };
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

const LARGE_DOCUMENT_THRESHOLD = 200_000;

function scheduleIdleWork(task: () => void, timeout = 1000): IdleHandle {
  return window.setTimeout(task, timeout);
}

function cancelIdleWork(handle: IdleHandle | null): void {
  if (handle === null) {
    return;
  }

  window.clearTimeout(handle);
}

function createMarkdownWorker(): Worker {
  return new Worker(new URL('../editor/markdown.worker.ts', import.meta.url), {
    type: 'module',
  });
}

const VISUAL_META_SYNC_DELAY_MS = 260;
const VISUAL_DOCUMENT_SYNC_TIMEOUT_MS = 1400;

interface EditorViewportProps {
  editor: TiptapEditor | null;
  editorHostRef: RefObject<HTMLDivElement>;
  loading: boolean;
  searchPanel: JSX.Element | null;
  sourceMode: boolean;
  sourceDraft: string;
  sourceTextareaRef: RefObject<HTMLTextAreaElement>;
  onFrameMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onSourceChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

const EditorViewport = memo(function EditorViewport({
  editor,
  editorHostRef,
  loading,
  searchPanel,
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
      {loading ? <div className="editor-loading">正在载入文档...</div> : null}
      {searchPanel}
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

interface SearchPanelProps {
  caseSensitive: boolean;
  currentMatchLabel: string;
  open: boolean;
  query: string;
  replaceVisible: boolean;
  replacement: string;
  onCaseSensitiveChange: () => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReplaceAll: () => void;
  onReplaceCurrent: () => void;
  onReplacementChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleReplace: () => void;
  queryInputRef: RefObject<HTMLInputElement>;
  replaceInputRef: RefObject<HTMLInputElement>;
}

const SearchPanel = memo(function SearchPanel({
  caseSensitive,
  currentMatchLabel,
  open,
  query,
  replaceVisible,
  replacement,
  onCaseSensitiveChange,
  onClose,
  onNext,
  onPrevious,
  onQueryChange,
  onReplaceAll,
  onReplaceCurrent,
  onReplacementChange,
  onToggleReplace,
  queryInputRef,
  replaceInputRef,
}: SearchPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="search-panel" role="dialog" aria-label="查找和替换">
      <div className="search-panel__row">
        <input
          ref={queryInputRef}
          className="search-panel__input"
          onChange={onQueryChange}
          placeholder="查找文本、公式源码、代码块内容"
          spellCheck={false}
          type="text"
          value={query}
        />
        <button
          className={caseSensitive ? 'search-panel__toggle is-active' : 'search-panel__toggle'}
          onClick={onCaseSensitiveChange}
          type="button"
        >
          Aa
        </button>
        <span className="search-panel__count">{currentMatchLabel}</span>
        <button className="search-panel__button" onClick={onPrevious} type="button">
          上一个
        </button>
        <button className="search-panel__button" onClick={onNext} type="button">
          下一个
        </button>
        <button className="search-panel__button" onClick={onToggleReplace} type="button">
          {replaceVisible ? '收起替换' : '展开替换'}
        </button>
        <button className="search-panel__button" onClick={onClose} type="button">
          关闭
        </button>
      </div>
      {replaceVisible ? (
        <div className="search-panel__row">
          <input
            ref={replaceInputRef}
            className="search-panel__input"
            onChange={onReplacementChange}
            placeholder="替换为"
            spellCheck={false}
            type="text"
            value={replacement}
          />
          <button className="search-panel__button" onClick={onReplaceCurrent} type="button">
            替换当前
          </button>
          <button className="search-panel__button" onClick={onReplaceAll} type="button">
            全部替换
          </button>
        </div>
      ) : null}
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const markdownWorkerRef = useRef<Worker | null>(null);
  const markdownWorkerRequestRef = useRef(0);
  const latestExternalLoadRef = useRef(0);
  const initialContentRef = useRef<JSONContent>(createEmptyDocument());
  const documentPathRef = useRef(document.path);
  const documentMarkdownRef = useRef(document.markdown);
  const largeDocumentModeRef = useRef(document.markdown.length >= LARGE_DOCUMENT_THRESHOLD);
  const visualMarkdownRef = useRef(document.markdown);
  const visualStatsRef = useRef(document.stats);
  const externalUpdateRef = useRef(false);
  const lastEmittedMarkdownRef = useRef('');
  const windowDirtyRef = useRef(document.dirty);
  const skipNextDocChangeRef = useRef(true);
  const skipNextDocChangeTimerRef = useRef<number | null>(null);
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
  const [loadingExternalDocument, setLoadingExternalDocument] = useState(false);
  const sourceModeRef = useRef(sourceMode);
  const sourceDraftRef = useRef(sourceDraft);
  const searchPanelOpenRef = useRef(false);
  const searchAutoRevealSignatureRef = useRef('');
  const [outline, setOutline] = useState<OutlineItem[]>(() => extractOutline(document.markdown));
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchReplaceVisible, setSearchReplaceVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchReplacement, setSearchReplacement] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);
  const [visualSearchRevision, setVisualSearchRevision] = useState(0);

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
    largeDocumentModeRef.current = document.markdown.length >= LARGE_DOCUMENT_THRESHOLD;
  }, [document.markdown.length]);

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
    searchPanelOpenRef.current = searchOpen;
  }, [searchOpen]);

  const armSkipNextDocChange = useCallback(() => {
    skipNextDocChangeRef.current = true;
    if (skipNextDocChangeTimerRef.current !== null) {
      window.clearTimeout(skipNextDocChangeTimerRef.current);
    }

    skipNextDocChangeTimerRef.current = window.setTimeout(() => {
      skipNextDocChangeRef.current = false;
      skipNextDocChangeTimerRef.current = null;
    }, 0);
  }, []);

  const applySourceMarkdown = useCallback(
    (markdown: string, selection?: SourceSearchMatch) => {
      const nextStats = computeSourceStats(markdown);
      const dirty = markdown !== document.savedMarkdown;
      setSourceDraft(markdown);
      setLiveStats((current) => (areStatsEqual(current, nextStats) ? current : nextStats));
      setLiveDirty(dirty);
      onDocumentChange(markdown, nextStats);
      const nextOutline = extractOutline(markdown);
      setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
      onDocumentMetaChange(dirty);

      if (selection) {
        requestAnimationFrame(() => {
          const input = sourceTextareaRef.current;
          if (!input) {
            return;
          }

          input.focus();
          input.setSelectionRange(selection.start, selection.end);
        });
      }
    },
    [document.savedMarkdown, onDocumentChange, onDocumentMetaChange],
  );

  const parseMarkdownInWorker = useCallback((markdown: string) => {
    if (!markdownWorkerRef.current) {
      markdownWorkerRef.current = createMarkdownWorker();
    }

    const worker = markdownWorkerRef.current;
    const requestId = ++markdownWorkerRequestRef.current;

    return new Promise<WorkerParseSuccess>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerParseResponse>) => {
        if (event.data.id !== requestId) {
          return;
        }

        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);

        if (event.data.ok) {
          resolve(event.data);
          return;
        }

        reject(new Error(event.data.error));
      };

      const handleError = (event: ErrorEvent) => {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        reject(event.error instanceof Error ? event.error : new Error(event.message));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError, { once: true });
      worker.postMessage({ id: requestId, markdown });
    });
  }, []);

  useEffect(() => {
    return () => {
      markdownWorkerRef.current?.terminate();
      markdownWorkerRef.current = null;
      if (skipNextDocChangeTimerRef.current !== null) {
        window.clearTimeout(skipNextDocChangeTimerRef.current);
        skipNextDocChangeTimerRef.current = null;
      }
    };
  }, []);

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
      setVisualSearchRevision((current) => current + 1);
      armSkipNextDocChange();
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
        if (!largeDocumentModeRef.current) {
          const canonicalMarkdown = serializeMarkdown(nextEditor.getJSON());
          const stats = calculateDocumentStats(getEditorPlainText(nextEditor));
          visualMarkdownRef.current = canonicalMarkdown;
          visualStatsRef.current = stats;
          lastEmittedMarkdownRef.current = canonicalMarkdown;
        }
        setLiveDirty(false);
        if (searchPanelOpenRef.current) {
          setVisualSearchRevision((current) => current + 1);
        }
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

      if (largeDocumentModeRef.current) {
        pendingVisualMetaSyncRef.current = window.setTimeout(() => {
          pendingVisualMetaSyncRef.current = null;
        }, 900);

        if (pendingVisualDocumentSyncRef.current !== null) {
          cancelIdleWork(pendingVisualDocumentSyncRef.current);
          pendingVisualDocumentSyncRef.current = null;
        }

        return;
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

      if (searchPanelOpenRef.current) {
        setVisualSearchRevision((current) => current + 1);
      }
    },
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.view.dom.setAttribute(
      'spellcheck',
      largeDocumentModeRef.current ? 'false' : 'true',
    );
  }, [document.markdown.length, editor]);

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
      setLoadingExternalDocument(false);
      return;
    }

    const loadId = latestExternalLoadRef.current + 1;
    latestExternalLoadRef.current = loadId;
    setLoadingExternalDocument(true);
    editor.setEditable(false);

    if (document.markdown.length < LARGE_DOCUMENT_THRESHOLD) {
      void import('../editor/markdown')
        .then(({ parseMarkdown }) => {
          if (latestExternalLoadRef.current !== loadId || sourceModeRef.current || !editor) {
            return;
          }

          externalUpdateRef.current = true;
          armSkipNextDocChange();
          editor.commands.setContent(parseMarkdown(document.markdown), false);
          externalUpdateRef.current = false;

          const canonicalMarkdown = serializeMarkdown(editor.getJSON());
          const stats = calculateDocumentStats(getEditorPlainText(editor));
          const nextOutline = extractOutline(document.markdown);
          visualMarkdownRef.current = canonicalMarkdown;
          visualStatsRef.current = stats;
          lastEmittedMarkdownRef.current = canonicalMarkdown;
          setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
          setLiveStats((current) => (areStatsEqual(current, stats) ? current : stats));
          setLiveDirty(document.dirty);
          setVisualSearchRevision((current) => current + 1);
        })
        .catch(() => {
          if (latestExternalLoadRef.current !== loadId || !editor) {
            return;
          }

          const emptyStats = computeSourceStats('');
          externalUpdateRef.current = true;
          armSkipNextDocChange();
          editor.commands.setContent(createEmptyDocument(), false);
          externalUpdateRef.current = false;
          visualMarkdownRef.current = '';
          visualStatsRef.current = emptyStats;
          lastEmittedMarkdownRef.current = '';
          setOutline((current) => (current.length === 0 ? current : []));
          setLiveStats((current) => (areStatsEqual(current, emptyStats) ? current : emptyStats));
          setLiveDirty(document.dirty);
          setVisualSearchRevision((current) => current + 1);
        })
        .finally(() => {
          if (latestExternalLoadRef.current === loadId) {
            editor.setEditable(true);
            setLoadingExternalDocument(false);
          }
        });

      return;
    }

    void parseMarkdownInWorker(document.markdown)
      .then((result) => {
        if (latestExternalLoadRef.current !== loadId || sourceModeRef.current || !editor) {
          return;
        }

        externalUpdateRef.current = true;
        armSkipNextDocChange();
        editor.commands.setContent(result.content, false);
        externalUpdateRef.current = false;

        const canonicalMarkdown = serializeMarkdown(editor.getJSON());
        const stats = calculateDocumentStats(getEditorPlainText(editor));
        visualMarkdownRef.current = canonicalMarkdown;
        visualStatsRef.current = stats;
        lastEmittedMarkdownRef.current = canonicalMarkdown;
        setOutline((current) => (areOutlinesEqual(current, result.outline) ? current : result.outline));
        setLiveStats((current) => (areStatsEqual(current, stats) ? current : stats));
        setLiveDirty(document.dirty);
        setVisualSearchRevision((current) => current + 1);
      })
      .catch(async () => {
        if (latestExternalLoadRef.current !== loadId || !editor) {
          return;
        }

        try {
          const { parseMarkdown } = await import('../editor/markdown');
          if (latestExternalLoadRef.current !== loadId || !editor) {
            return;
          }

          externalUpdateRef.current = true;
          armSkipNextDocChange();
          editor.commands.setContent(parseMarkdown(document.markdown), false);
          externalUpdateRef.current = false;

          const canonicalMarkdown = serializeMarkdown(editor.getJSON());
          const stats = calculateDocumentStats(getEditorPlainText(editor));
          const nextOutline = extractOutline(document.markdown);
          visualMarkdownRef.current = canonicalMarkdown;
          visualStatsRef.current = stats;
          lastEmittedMarkdownRef.current = canonicalMarkdown;
          setOutline((current) => (areOutlinesEqual(current, nextOutline) ? current : nextOutline));
          setLiveStats((current) => (areStatsEqual(current, stats) ? current : stats));
          setLiveDirty(document.dirty);
          setVisualSearchRevision((current) => current + 1);
          return;
        } catch {
          if (latestExternalLoadRef.current !== loadId || !editor) {
            return;
          }

          const emptyStats = computeSourceStats('');
          externalUpdateRef.current = true;
          armSkipNextDocChange();
          editor.commands.setContent(createEmptyDocument(), false);
          externalUpdateRef.current = false;
          visualMarkdownRef.current = '';
          visualStatsRef.current = emptyStats;
          lastEmittedMarkdownRef.current = '';
          setOutline((current) => (current.length === 0 ? current : []));
          setLiveStats((current) => (areStatsEqual(current, emptyStats) ? current : emptyStats));
          setLiveDirty(document.dirty);
          setVisualSearchRevision((current) => current + 1);
        }
      })
      .finally(() => {
        if (latestExternalLoadRef.current === loadId) {
          editor.setEditable(true);
          setLoadingExternalDocument(false);
        }
      });
  }, [document.markdown, document.path, editor, parseMarkdownInWorker, sourceMode]);

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

  const searchMatches = useMemo<Array<SourceSearchMatch | VisualSearchMatch>>(() => {
    if (!searchOpen || !searchQuery) {
      return [];
    }

    if (sourceMode) {
      return findSourceSearchMatches(sourceDraft, searchQuery, {
        caseSensitive: searchCaseSensitive,
      });
    }

    if (!editor) {
      return [];
    }

    return findVisualSearchMatches(editor, searchQuery, {
      caseSensitive: searchCaseSensitive,
    });
  }, [
    editor,
    searchCaseSensitive,
    searchOpen,
    searchQuery,
    sourceDraft,
    sourceMode,
    visualSearchRevision,
  ]);

  const revealSourceMatch = useCallback((match: SourceSearchMatch) => {
    requestAnimationFrame(() => {
      const input = sourceTextareaRef.current;
      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(match.start, match.end);
    });
  }, []);

  const revealVisualMatch = useCallback(
    (match: VisualSearchMatch) => {
      if (!editor) {
        return;
      }

      selectVisualSearchMatch(editor, match);
      if (match.kind === 'math') {
        window.dispatchEvent(
          new CustomEvent('markdown-editor:focus-math-search-match', {
            detail: {
              pos: match.pos,
              start: match.start,
              end: match.end,
            },
          }),
        );
      }
    },
    [editor],
  );

  const jumpToSearchMatch = useCallback(
    (nextIndex: number) => {
      if (!searchMatches.length) {
        setSearchCurrentIndex(0);
        return;
      }

      const normalized =
        ((nextIndex % searchMatches.length) + searchMatches.length) % searchMatches.length;
      setSearchCurrentIndex(normalized);

      const match = searchMatches[normalized];
      if (sourceMode) {
        revealSourceMatch(match as SourceSearchMatch);
        return;
      }

      revealVisualMatch(match as VisualSearchMatch);
    },
    [revealSourceMatch, revealVisualMatch, searchMatches, sourceMode],
  );

  const getSelectedSearchText = useCallback(() => {
    if (sourceModeRef.current) {
      const input = sourceTextareaRef.current;
      if (!input) {
        return '';
      }

      const selected = input.value.slice(input.selectionStart, input.selectionEnd).trim();
      return selected;
    }

    if (!editor) {
      return '';
    }

    const { from, to, empty } = editor.state.selection;
    if (empty) {
      return '';
    }

    return editor.state.doc.textBetween(from, to, '\n', '\n').trim();
  }, [editor]);

  const openSearchPanel = useCallback(
    (showReplace = false) => {
      const selectedText = getSelectedSearchText();
      setSearchOpen(true);
      setSearchReplaceVisible((current) => current || showReplace);
      if (selectedText) {
        setSearchQuery(selectedText);
      }

      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    },
    [getSelectedSearchText],
  );

  const closeSearchPanel = useCallback(() => {
    setSearchOpen(false);
    searchAutoRevealSignatureRef.current = '';
  }, []);

  const handleReplaceCurrent = useCallback(() => {
    if (!searchMatches.length || !searchQuery) {
      return;
    }

    const match = searchMatches[searchCurrentIndex];
    if (sourceMode) {
      const result = replaceSourceSearchMatch(
        sourceDraftRef.current,
        match as SourceSearchMatch,
        searchReplacement,
      );
      applySourceMarkdown(result.markdown, result.selection);
      return;
    }

    if (!editor) {
      return;
    }

    const replaced = replaceVisualSearchMatch(editor, match as VisualSearchMatch, searchReplacement);
    if (!replaced) {
      return;
    }

    flushVisualSync(editor);
    setVisualSearchRevision((current) => current + 1);
  }, [
    applySourceMarkdown,
    editor,
    searchCurrentIndex,
    searchMatches,
    searchQuery,
    searchReplacement,
    sourceMode,
  ]);

  const handleReplaceAll = useCallback(() => {
    if (!searchQuery) {
      return;
    }

    if (sourceMode) {
      const result = replaceAllSourceSearchMatches(
        sourceDraftRef.current,
        searchQuery,
        searchReplacement,
        {
          caseSensitive: searchCaseSensitive,
        },
      );

      if (!result.count) {
        return;
      }

      applySourceMarkdown(result.markdown, result.firstSelection ?? undefined);
      return;
    }

    if (!editor) {
      return;
    }

    const replacedCount = replaceAllVisualSearchMatches(editor, searchQuery, searchReplacement, {
      caseSensitive: searchCaseSensitive,
    });
    if (!replacedCount) {
      return;
    }

    flushVisualSync(editor);
    setVisualSearchRevision((current) => current + 1);
  }, [
    applySourceMarkdown,
    editor,
    searchCaseSensitive,
    searchQuery,
    searchReplacement,
    sourceMode,
  ]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    if (!searchMatches.length) {
      setSearchCurrentIndex(0);
      return;
    }

    setSearchCurrentIndex((current) => Math.min(current, searchMatches.length - 1));
  }, [searchMatches.length, searchOpen]);

  useEffect(() => {
    if (!searchOpen || !searchQuery) {
      searchAutoRevealSignatureRef.current = '';
      return;
    }

    const signature = `${sourceMode ? 'source' : 'visual'}:${searchCaseSensitive}:${searchQuery}`;
    if (searchAutoRevealSignatureRef.current === signature) {
      return;
    }

    searchAutoRevealSignatureRef.current = signature;
    jumpToSearchMatch(0);
  }, [jumpToSearchMatch, searchCaseSensitive, searchMatches.length, searchOpen, searchQuery, sourceMode]);

  const searchPanel = (
    <SearchPanel
      caseSensitive={searchCaseSensitive}
      currentMatchLabel={searchQuery ? `${searchMatches.length ? searchCurrentIndex + 1 : 0}/${searchMatches.length}` : '输入关键词'}
      onCaseSensitiveChange={() => setSearchCaseSensitive((current) => !current)}
      onClose={closeSearchPanel}
      onNext={() => jumpToSearchMatch(searchCurrentIndex + 1)}
      onPrevious={() => jumpToSearchMatch(searchCurrentIndex - 1)}
      onQueryChange={(event) => setSearchQuery(event.target.value)}
      onReplaceAll={handleReplaceAll}
      onReplaceCurrent={handleReplaceCurrent}
      onReplacementChange={(event) => setSearchReplacement(event.target.value)}
      onToggleReplace={() => {
        setSearchReplaceVisible((current) => !current);
        requestAnimationFrame(() => {
          if (searchReplaceVisible) {
            searchInputRef.current?.focus();
            return;
          }

          replaceInputRef.current?.focus();
          replaceInputRef.current?.select();
        });
      }}
      open={searchOpen}
      query={searchQuery}
      queryInputRef={searchInputRef}
      replaceInputRef={replaceInputRef}
      replacement={searchReplacement}
      replaceVisible={searchReplaceVisible}
    />
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 'f') {
        event.preventDefault();
        openSearchPanel(false);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'h') {
        event.preventDefault();
        openSearchPanel(true);
        return;
      }

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

      if (
        event.key === 'Escape' &&
        searchOpen &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('.search-panel')
      ) {
        event.preventDefault();
        closeSearchPanel();
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
  }, [closeSearchPanel, onSaveDocument, onSaveDocumentAs, openSearchPanel, searchOpen]);

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
      applySourceMarkdown(event.target.value);
    },
    [applySourceMarkdown],
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
        onOpenSearch={openSearchPanel}
        onSave={handleToolbarSave}
        onSaveAs={handleToolbarSaveAs}
        searchVisible={searchOpen}
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
          loading={loadingExternalDocument}
          onFrameMouseDown={handleFrameMouseDown}
          onSourceChange={handleSourceChange}
          searchPanel={searchPanel}
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
            applySourceMarkdown(markdown, {
              start: start + insertion.length,
              end: start + insertion.length,
            });
            event.target.value = '';
            return;
          }

          if (!editor) {
            return;
          }

          editor.chain().focus().setImage({ src: saved.markdownPath, alt: '', title: undefined }).run();
          event.target.value = '';
        }}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}

