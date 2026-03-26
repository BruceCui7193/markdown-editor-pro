import { memo, useEffect, useRef, useState, type ComponentProps } from 'react';
import clsx from 'clsx';
import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import type { ThemeMode } from '@shared/contracts';
import { THEME_PALETTE_OPTIONS, type ThemePalette } from '../theme';
import { CODE_LANGUAGE_OPTIONS } from '../editor/code-languages';
import Icon from './icons';

interface ToolbarProps {
  editor: Editor | null;
  theme: ThemeMode;
  themePalette: ThemePalette;
  searchVisible: boolean;
  sourceMode: boolean;
  toolbarVisible: boolean;
  sidebarVisible: boolean;
  onOpen: () => void;
  onOpenFolder: () => void;
  onOpenSearch: (showReplace?: boolean) => void;
  onCloseSearch: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onNewWindow: () => void;
  onInsertImage: () => void;
  onSetTheme: (theme: ThemeMode) => void;
  onSetThemePalette: (palette: ThemePalette) => void;
  onToggleToolbar: () => void;
  onToggleSidebar: () => void;
  onToggleSourceMode: () => void;
}

interface ToolbarButtonProps {
  icon: ComponentProps<typeof Icon>['name'];
  active?: boolean;
  hidden?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}

type ToolbarLayoutMode = 'full' | 'dense' | 'compact';
type ToolbarGroupId = 'document' | 'text-style' | 'structure' | 'insert' | 'view';

function ToolbarButton({
  icon,
  active = false,
  hidden = false,
  onClick,
  disabled = false,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      aria-hidden={hidden}
      aria-label={title}
      className={clsx('toolbar-button', active && 'is-active', hidden && 'is-source-hidden')}
      data-tooltip={title}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      tabIndex={hidden ? -1 : 0}
      type="button"
    >
      <Icon className="toolbar-button__icon" name={icon} />
    </button>
  );
}

function getNextFootnoteLabel(editor: Editor): string {
  let highestNumericLabel = 0;
  let fallbackCount = 0;

  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'footnoteReference' && node.type.name !== 'footnoteDefinition') {
      return true;
    }

    fallbackCount += 1;
    const rawLabel = String(node.attrs.label ?? '').trim();
    if (/^\d+$/.test(rawLabel)) {
      highestNumericLabel = Math.max(highestNumericLabel, Number(rawLabel));
    }

    return true;
  });

  return String(highestNumericLabel > 0 ? highestNumericLabel + 1 : fallbackCount + 1);
}

function getSelectedPlainText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, '\n', '\n');
}

function isInlineJsonNode(node: JSONContent): boolean {
  return ['text', 'hardBreak', 'mathInline', 'footnoteReference'].includes(String(node.type ?? ''));
}

function normalizeFootnoteContent(content: JSONContent[]): JSONContent[] {
  if (!content.length) {
    return [{ type: 'paragraph' }];
  }

  const normalized: JSONContent[] = [];
  let pendingInlineContent: JSONContent[] = [];

  const flushInlineContent = () => {
    if (!pendingInlineContent.length) {
      return;
    }

    normalized.push({
      type: 'paragraph',
      content: pendingInlineContent,
    });
    pendingInlineContent = [];
  };

  content.forEach((node) => {
    if (isInlineJsonNode(node)) {
      pendingInlineContent.push(node);
      return;
    }

    flushInlineContent();
    normalized.push(node);
  });

  flushInlineContent();

  if (!normalized.length) {
    return [{ type: 'paragraph' }];
  }

  return normalized;
}

function Toolbar({
  editor,
  theme,
  themePalette,
  searchVisible,
  sourceMode,
  toolbarVisible,
  sidebarVisible,
  onOpen,
  onOpenFolder,
  onOpenSearch,
  onCloseSearch,
  onSave,
  onSaveAs,
  onNewWindow,
  onInsertImage,
  onSetTheme,
  onSetThemePalette,
  onToggleToolbar,
  onToggleSidebar,
  onToggleSourceMode,
}: ToolbarProps) {
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<ToolbarLayoutMode>('full');
  const [denseStep, setDenseStep] = useState(0);
  const [compactGroupOpen, setCompactGroupOpen] = useState<ToolbarGroupId | null>(null);
  const [formulaMenuOpen, setFormulaMenuOpen] = useState(false);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('https://');
  const [codeLanguageDraft, setCodeLanguageDraft] = useState('');
  const [, setEditorRevision] = useState(0);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const labels = {
    hideToolbar: '隐藏工具栏',
    hideSidebar: '隐藏侧栏',
    showSidebar: '显示侧栏',
    newWindow: '新建窗口',
    openFile: '打开文件（新窗口）',
    openFolder: '打开文件夹（新窗口）',
    save: '保存',
    saveAs: '另存为',
    findReplace: '查找与替换',
    heading1: '一级标题',
    heading2: '二级标题',
    bold: '加粗',
    italic: '斜体',
    underline: '下划线',
    strike: '删除线',
    link: '链接',
    linkApply: '应用链接',
    linkRemove: '移除链接',
    linkPlaceholder: '输入链接地址',
    quote: '引用',
    bullet: '无序列表',
    ordered: '有序列表',
    task: '任务列表',
    table: '插入表格',
    code: '代码块',
    math: '插入公式',
    mathInline: '行内公式 ($)',
    mathBlock: '行间公式 ($$)',
    mermaid: '插入 Mermaid 图表',
    image: '插入图片',
    footnote: '插入脚注',
    sourceOn: '切回所见即所得模式',
    sourceOff: '切换到源码模式',
    themePanel: '主题与配色',
    showToolbar: '显示工具栏',
    appearanceMode: '外观模式',
    paletteScheme: '配色方案',
    auto: '自动',
    light: '浅色',
    dark: '深色',
    document: '文档',
    textStyle: '文本',
    structure: '结构',
    insert: '插入',
    view: '视图',
  };
  const themeLabel =
    theme === 'system' ? '主题：自动' : theme === 'light' ? '主题：浅色' : '主题：深色';
  const currentPalette = THEME_PALETTE_OPTIONS.find((option) => option.id === themePalette);
  const editingControlsHidden = sourceMode;
  const isLinkActive = editor?.isActive('link') ?? false;
  const isTableActive = editor?.isActive('table') ?? false;
  const isCodeBlockActive = editor?.isActive('codeBlock') ?? false;
  const currentCodeLanguage = String(editor?.getAttributes('codeBlock').language ?? '').trim();
  const hasLinkFloatingPanel = linkMenuOpen && !editingControlsHidden;
  const hasFormulaFloatingPanel = formulaMenuOpen && !editingControlsHidden;

  useEffect(() => {
    if (!editor) {
      return;
    }

    const rerender = () => setEditorRevision((current) => current + 1);

    editor.on('transaction', rerender);
    editor.on('selectionUpdate', rerender);
    editor.on('focus', rerender);
    editor.on('blur', rerender);

    return () => {
      editor.off('transaction', rerender);
      editor.off('selectionUpdate', rerender);
      editor.off('focus', rerender);
      editor.off('blur', rerender);
    };
  }, [editor]);

  useEffect(() => {
    if (!themePanelOpen && !compactGroupOpen && !formulaMenuOpen && !linkMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setThemePanelOpen(false);
        setCompactGroupOpen(null);
        setFormulaMenuOpen(false);
        setLinkMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setThemePanelOpen(false);
        setCompactGroupOpen(null);
        setFormulaMenuOpen(false);
        setLinkMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [compactGroupOpen, formulaMenuOpen, linkMenuOpen, themePanelOpen]);

  useEffect(() => {
    if (!toolbarVisible) {
      return;
    }

    const toolbar = toolbarRef.current;
    if (!toolbar) {
      return;
    }

    const updateLayoutMode = () => {
      const width = toolbar.clientWidth;
      if (width <= 700) {
        setLayoutMode((current) => (current === 'compact' ? current : 'compact'));
        setDenseStep(0);
        return;
      }

      if (width <= 1320) {
        setLayoutMode((current) => (current === 'dense' ? current : 'dense'));
        const nextDenseStep =
          width <= 780 ? 5 : width <= 900 ? 4 : width <= 1020 ? 3 : width <= 1140 ? 2 : 1;
        setDenseStep((current) => (current === nextDenseStep ? current : nextDenseStep));
        return;
      }

      setLayoutMode((current) => (current === 'full' ? current : 'full'));
      setDenseStep(0);
    };

    requestAnimationFrame(updateLayoutMode);
    const observer = new ResizeObserver(updateLayoutMode);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [toolbarVisible]);

  useEffect(() => {
    if (layoutMode !== 'compact') {
      setCompactGroupOpen(null);
    }
  }, [layoutMode]);

  useEffect(() => {
    if (!sourceMode) {
      return;
    }

    if (
      compactGroupOpen === 'text-style' ||
      compactGroupOpen === 'structure' ||
      compactGroupOpen === 'insert'
    ) {
      setCompactGroupOpen(null);
    }

    setFormulaMenuOpen(false);
    setLinkMenuOpen(false);
  }, [compactGroupOpen, sourceMode]);

  useEffect(() => {
    if (toolbarVisible) {
      return;
    }

    setThemePanelOpen(false);
    setCompactGroupOpen(null);
    setFormulaMenuOpen(false);
    setLinkMenuOpen(false);
  }, [toolbarVisible]);

  useEffect(() => {
    if (!linkMenuOpen) {
      return;
    }

    requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    });
  }, [linkMenuOpen]);

  useEffect(() => {
    if (!isCodeBlockActive) {
      setCodeLanguageDraft('');
      return;
    }

    setCodeLanguageDraft(currentCodeLanguage);
  }, [currentCodeLanguage, isCodeBlockActive]);

  const isDenseSplitGroup = (group: ToolbarGroupId): boolean => {
    if (layoutMode !== 'dense') {
      return false;
    }

    const thresholds: Record<ToolbarGroupId, number> = {
      'text-style': 1,
      structure: 2,
      document: 3,
      insert: 4,
      view: 5,
    };

    return denseStep >= thresholds[group];
  };

  const runCompactAction = (action: () => void) => {
    action();
    setCompactGroupOpen(null);
  };

  const runSearchAction = () => {
    if (searchVisible) {
      onCloseSearch();
      return;
    }

    onOpenSearch(true);
  };

  const insertInlineMath = () => {
    if (!editor) {
      return;
    }

    editor.chain().focus().insertInlineMath().run();
  };

  const insertBlockMath = () => {
    if (!editor) {
      return;
    }

    if (editor.state.selection.empty) {
      editor.chain().focus().insertMathBlock().run();
      return;
    }

    const value = getSelectedPlainText(editor);
    editor.chain().focus().insertMathBlock(value).run();
  };

  const openLinkMenu = () => {
    if (!editor || editingControlsHidden) {
      return;
    }

    const currentHref = String(editor.getAttributes('link').href ?? '').trim();
    setLinkDraft(currentHref || 'https://');
    setFormulaMenuOpen(false);
    setLinkMenuOpen((current) => !current);
  };

  const applyLink = () => {
    if (!editor) {
      return;
    }

    const href = linkDraft.trim();
    if (!href) {
      return;
    }

    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: '链接',
          marks: [
            {
              type: 'link',
              attrs: { href },
            },
          ],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }

    setLinkMenuOpen(false);
  };

  const removeLink = () => {
    if (!editor) {
      return;
    }

    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkMenuOpen(false);
  };

  const insertFootnote = () => {
    if (!editor) {
      return;
    }

    const label = getNextFootnoteLabel(editor);
    const selectionEmpty = editor.state.selection.empty;
    const selectedContent = selectionEmpty
      ? [{ type: 'paragraph' }]
      : normalizeFootnoteContent(editor.state.selection.content().content.toJSON() as JSONContent[]);

    editor
      .chain()
      .focus()
      .command(({ dispatch, state, tr }) => {
        const referenceNode = state.schema.nodes.footnoteReference?.create({ label });
        const definitionNode = state.schema.nodes.footnoteDefinition?.create(
          { label },
          selectedContent.length ? selectedContent.map((node) => state.schema.nodeFromJSON(node as any)) : undefined,
        );

        if (!referenceNode || !definitionNode) {
          return false;
        }

        tr = tr.replaceSelectionWith(referenceNode, false);

        if (selectionEmpty) {
          tr = tr.insert(tr.doc.content.size, definitionNode);
        } else {
          const paragraphNode = state.schema.nodes.paragraph?.create();

          if (!paragraphNode) {
            return false;
          }

          const insertAfter = state.selection.$to.after(1);
          tr = tr.insert(tr.mapping.map(insertAfter), [paragraphNode, definitionNode]);
        }

        if (dispatch) {
          dispatch(tr.scrollIntoView());
        }

        return true;
      })
      .run();
  };

  const insertCodeBlock = () => {
    if (!editor) {
      return;
    }

    if (editor.state.selection.empty) {
      editor.chain().focus().toggleCodeBlock().run();
      return;
    }

    const selectedText = getSelectedPlainText(editor);
    editor
      .chain()
      .focus()
      .command(({ dispatch, state, tr }) => {
        const codeBlockNode = state.schema.nodes.codeBlock?.create(
          { language: null },
          selectedText ? [state.schema.text(selectedText)] : undefined,
        );

        if (!codeBlockNode) {
          return false;
        }

        tr = tr.replaceSelectionWith(codeBlockNode, false);

        if (dispatch) {
          dispatch(tr.scrollIntoView());
        }

        return true;
      })
      .run();
  };

  const updateCodeBlockLanguage = (language: string) => {
    if (!editor) {
      return;
    }

    const nextLanguage = language.trim();
    editor
      .chain()
      .focus()
      .updateAttributes('codeBlock', {
        language: nextLanguage || null,
      })
      .run();
  };

  const renderTableActions = () => {
    if (!isTableActive) {
      return null;
    }

    return (
      <>
        <ToolbarButton
          disabled={!editor}
          hidden={editingControlsHidden}
          icon="rowAddBefore"
          onClick={() => runCompactAction(() => editor?.chain().focus().addRowBefore().run())}
          title="在上方插入行"
        />
        <ToolbarButton
          disabled={!editor}
          hidden={editingControlsHidden}
          icon="rowAddAfter"
          onClick={() => runCompactAction(() => editor?.chain().focus().addRowAfter().run())}
          title="在下方插入行"
        />
        <ToolbarButton
          disabled={!editor}
          hidden={editingControlsHidden}
          icon="rowDelete"
          onClick={() => runCompactAction(() => editor?.chain().focus().deleteRow().run())}
          title="删除当前行"
        />
        <ToolbarButton
          disabled={!editor}
          hidden={editingControlsHidden}
          icon="columnAddBefore"
          onClick={() => runCompactAction(() => editor?.chain().focus().addColumnBefore().run())}
          title="在左侧插入列"
        />
        <ToolbarButton
          disabled={!editor}
          hidden={editingControlsHidden}
          icon="columnAddAfter"
          onClick={() => runCompactAction(() => editor?.chain().focus().addColumnAfter().run())}
          title="在右侧插入列"
        />
        <ToolbarButton
          disabled={!editor}
          hidden={editingControlsHidden}
          icon="columnDelete"
          onClick={() => runCompactAction(() => editor?.chain().focus().deleteColumn().run())}
          title="删除当前列"
        />
        <ToolbarButton
          disabled={!editor}
          hidden={editingControlsHidden}
          icon="tableDelete"
          onClick={() => runCompactAction(() => editor?.chain().focus().deleteTable().run())}
          title="删除表格"
        />
      </>
    );
  };

  const renderGroupActions = (group: ToolbarGroupId) => {
    if (group === 'document') {
      return (
        <>
          <ToolbarButton icon="menu" onClick={() => runCompactAction(onToggleToolbar)} title={labels.hideToolbar} />
          <ToolbarButton
            active={sidebarVisible}
            icon="sidebar"
            onClick={() => runCompactAction(onToggleSidebar)}
            title={sidebarVisible ? labels.hideSidebar : labels.showSidebar}
          />
          <ToolbarButton icon="newWindow" onClick={() => runCompactAction(onNewWindow)} title={labels.newWindow} />
          <ToolbarButton icon="open" onClick={() => runCompactAction(onOpen)} title={labels.openFile} />
          <ToolbarButton icon="folder" onClick={() => runCompactAction(onOpenFolder)} title={labels.openFolder} />
          <ToolbarButton icon="save" onClick={() => runCompactAction(onSave)} title={labels.save} />
          <ToolbarButton icon="saveAs" onClick={() => runCompactAction(onSaveAs)} title={labels.saveAs} />
          <ToolbarButton
            active={searchVisible}
            icon="search"
            onClick={() => runCompactAction(runSearchAction)}
            title={labels.findReplace}
          />
        </>
      );
    }

    if (group === 'text-style') {
      return (
        <>
          <ToolbarButton
            active={editor?.isActive('heading', { level: 1 }) ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="heading1"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
            title={labels.heading1}
          />
          <ToolbarButton
            active={editor?.isActive('heading', { level: 2 }) ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="heading2"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
            title={labels.heading2}
          />
          <ToolbarButton
            active={editor?.isActive('bold') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="bold"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleBold().run())}
            title={labels.bold}
          />
          <ToolbarButton
            active={editor?.isActive('italic') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="italic"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleItalic().run())}
            title={labels.italic}
          />
          <ToolbarButton
            active={editor?.isActive('underline') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="underline"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleUnderline().run())}
            title={labels.underline}
          />
          <ToolbarButton
            active={editor?.isActive('strike') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="strike"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleStrike().run())}
            title={labels.strike}
          />
          <div
            className={clsx(
              'toolbar-submenu-anchor',
              editingControlsHidden && 'is-source-hidden',
              hasLinkFloatingPanel && 'has-open-panel',
            )}
          >
            <button
              aria-hidden={editingControlsHidden}
              aria-label={labels.link}
              aria-expanded={linkMenuOpen}
              className={clsx('toolbar-button', isLinkActive && 'is-active', linkMenuOpen && 'is-active', editingControlsHidden && 'is-source-hidden')}
              data-tooltip={labels.link}
              disabled={!editor}
              onClick={() => runCompactAction(openLinkMenu)}
              onMouseDown={(event) => event.preventDefault()}
              tabIndex={editingControlsHidden ? -1 : 0}
              type="button"
            >
              <Icon className="toolbar-button__icon" name="link" />
            </button>
            <div
              aria-hidden={!linkMenuOpen}
              className={linkMenuOpen ? 'toolbar-submenu is-open' : 'toolbar-submenu is-closed'}
            >
              <input
                ref={linkInputRef}
                className="toolbar-submenu__input"
                onChange={(event) => setLinkDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyLink();
                  }
                }}
                placeholder={labels.linkPlaceholder}
                spellCheck={false}
                type="text"
                value={linkDraft}
              />
              <button
                className="toolbar-submenu__item"
                onClick={applyLink}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {labels.linkApply}
              </button>
              <button
                className="toolbar-submenu__item"
                onClick={removeLink}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {labels.linkRemove}
              </button>
            </div>
          </div>
        </>
      );
    }

    if (group === 'structure') {
      return (
        <>
          <ToolbarButton
            active={editor?.isActive('blockquote') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="quote"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleBlockquote().run())}
            title={labels.quote}
          />
          <ToolbarButton
            active={editor?.isActive('bulletList') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="bullet"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleBulletList().run())}
            title={labels.bullet}
          />
          <ToolbarButton
            active={editor?.isActive('orderedList') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="ordered"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleOrderedList().run())}
            title={labels.ordered}
          />
          <ToolbarButton
            active={editor?.isActive('taskList') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="task"
            onClick={() => runCompactAction(() => editor?.chain().focus().toggleTaskList().run())}
            title={labels.task}
          />
          <ToolbarButton
            active={isTableActive}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="table"
            onClick={() =>
              runCompactAction(() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
              )
            }
            title={labels.table}
          />
          {renderTableActions()}
          <ToolbarButton
            active={editor?.isActive('codeBlock') ?? false}
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="code"
            onClick={() => runCompactAction(insertCodeBlock)}
            title={labels.code}
          />
          {isCodeBlockActive ? (
            <div className={clsx('toolbar-language-control', editingControlsHidden && 'is-source-hidden')}>
              <span className="toolbar-language-control__prefix">语言</span>
              <input
                className="toolbar-language-control__input"
                disabled={!editor}
                list="toolbar-code-language-options"
                onBlur={() => updateCodeBlockLanguage(codeLanguageDraft)}
                onChange={(event) => setCodeLanguageDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    updateCodeBlockLanguage(codeLanguageDraft);
                  }
                }}
                placeholder="例如：ts / python / mermaid"
                spellCheck={false}
                title="输入或选择代码块语言"
                type="text"
                value={codeLanguageDraft}
              />
              <datalist id="toolbar-code-language-options">
                {CODE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value || 'plain'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            </div>
          ) : null}
        </>
      );
    }

    if (group === 'insert') {
      return (
        <>
          <div
            className={clsx(
              'toolbar-submenu-anchor',
              editingControlsHidden && 'is-source-hidden',
              hasFormulaFloatingPanel && 'has-open-panel',
            )}
          >
            <button
              aria-hidden={editingControlsHidden}
              aria-label={labels.math}
              aria-expanded={formulaMenuOpen}
              className={clsx('toolbar-button', formulaMenuOpen && 'is-active', editingControlsHidden && 'is-source-hidden')}
              data-tooltip={labels.math}
              disabled={!editor}
              onClick={() => {
                setLinkMenuOpen(false);
                setFormulaMenuOpen((current) => !current);
              }}
              onMouseDown={(event) => event.preventDefault()}
              tabIndex={editingControlsHidden ? -1 : 0}
              type="button"
            >
              <Icon className="toolbar-button__icon" name="math" />
            </button>
            <div
              aria-hidden={!formulaMenuOpen}
              className={formulaMenuOpen ? 'toolbar-submenu is-open' : 'toolbar-submenu is-closed'}
            >
              <button
                className="toolbar-submenu__item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  runCompactAction(insertInlineMath);
                  setFormulaMenuOpen(false);
                }}
                type="button"
              >
                {labels.mathInline}
              </button>
              <button
                className="toolbar-submenu__item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  runCompactAction(insertBlockMath);
                  setFormulaMenuOpen(false);
                }}
                type="button"
              >
                {labels.mathBlock}
              </button>
            </div>
          </div>
          <ToolbarButton
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="diagram"
            onClick={() =>
              runCompactAction(() => editor?.chain().focus().insertMermaidBlock('').run())
            }
            title={labels.mermaid}
          />
          <ToolbarButton
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="image"
            onClick={() => runCompactAction(onInsertImage)}
            title={labels.image}
          />
          <ToolbarButton
            disabled={!editor}
            hidden={editingControlsHidden}
            icon="footnote"
            onClick={() => runCompactAction(insertFootnote)}
            title={labels.footnote}
          />
        </>
      );
    }

    return (
      <>
        <ToolbarButton
          active={sourceMode}
          icon="source"
          onClick={() => runCompactAction(onToggleSourceMode)}
          title={sourceMode ? labels.sourceOn : labels.sourceOff}
        />
        <ToolbarButton
          active={themePanelOpen || theme !== 'system'}
          icon="appearance"
          onClick={() => setThemePanelOpen((current) => !current)}
          title={`${labels.themePanel} / ${themeLabel} / ${currentPalette?.label ?? labels.auto}`}
        />
      </>
    );
  };

  return (
    <>
      <header
        aria-hidden={!toolbarVisible}
        className={clsx('toolbar', `toolbar--${layoutMode}`, toolbarVisible ? 'is-visible' : 'is-hidden')}
        ref={toolbarRef}
      >
        <div className="toolbar__row">
          {layoutMode === 'compact' ? (
            <>
              <button
                className={clsx('toolbar-group-launcher', compactGroupOpen === 'document' && 'is-active')}
                onClick={() => setCompactGroupOpen((current) => (current === 'document' ? null : 'document'))}
                type="button"
              >
                <Icon className="toolbar-group-launcher__icon" name="open" />
                <span>{labels.document}</span>
              </button>
              <button
                aria-hidden={editingControlsHidden}
                className={clsx(
                  'toolbar-group-launcher toolbar-group-launcher--collapsible',
                  compactGroupOpen === 'text-style' && 'is-active',
                  editingControlsHidden && 'is-source-hidden',
                )}
                onClick={() => setCompactGroupOpen((current) => (current === 'text-style' ? null : 'text-style'))}
                tabIndex={editingControlsHidden ? -1 : 0}
                type="button"
              >
                <Icon className="toolbar-group-launcher__icon" name="bold" />
                <span>{labels.textStyle}</span>
              </button>
              <button
                aria-hidden={editingControlsHidden}
                className={clsx(
                  'toolbar-group-launcher toolbar-group-launcher--collapsible',
                  compactGroupOpen === 'structure' && 'is-active',
                  editingControlsHidden && 'is-source-hidden',
                )}
                onClick={() => setCompactGroupOpen((current) => (current === 'structure' ? null : 'structure'))}
                tabIndex={editingControlsHidden ? -1 : 0}
                type="button"
              >
                <Icon className="toolbar-group-launcher__icon" name="bullet" />
                <span>{labels.structure}</span>
              </button>
              <button
                aria-hidden={editingControlsHidden}
                className={clsx(
                  'toolbar-group-launcher toolbar-group-launcher--collapsible',
                  compactGroupOpen === 'insert' && 'is-active',
                  editingControlsHidden && 'is-source-hidden',
                )}
                onClick={() => setCompactGroupOpen((current) => (current === 'insert' ? null : 'insert'))}
                tabIndex={editingControlsHidden ? -1 : 0}
                type="button"
              >
                <Icon className="toolbar-group-launcher__icon" name="image" />
                <span>{labels.insert}</span>
              </button>
              <button
                className={clsx('toolbar-group-launcher', compactGroupOpen === 'view' && 'is-active')}
                onClick={() => setCompactGroupOpen((current) => (current === 'view' ? null : 'view'))}
                type="button"
              >
                <Icon className="toolbar-group-launcher__icon" name="appearance" />
                <span>{labels.view}</span>
              </button>
            </>
          ) : (
            <>
              <div
                className={clsx('toolbar__group toolbar__group--document', isDenseSplitGroup('document') && 'is-split')}
              >
                {renderGroupActions('document')}
              </div>
              <div
                className={clsx(
                  'toolbar__group toolbar__group--text-style toolbar__group--collapsible',
                  hasLinkFloatingPanel && 'has-floating-panel',
                  isDenseSplitGroup('text-style') && 'is-split',
                  editingControlsHidden && 'is-source-hidden',
                )}
              >
                {renderGroupActions('text-style')}
              </div>
              <div
                className={clsx(
                  'toolbar__group toolbar__group--structure toolbar__group--collapsible',
                  isDenseSplitGroup('structure') && 'is-split',
                  editingControlsHidden && 'is-source-hidden',
                )}
              >
                {renderGroupActions('structure')}
              </div>
              <div
                className={clsx(
                  'toolbar__group toolbar__group--insert toolbar__group--collapsible',
                  hasFormulaFloatingPanel && 'has-floating-panel',
                  isDenseSplitGroup('insert') && 'is-split',
                  editingControlsHidden && 'is-source-hidden',
                )}
              >
                {renderGroupActions('insert')}
              </div>
              <div className={clsx('toolbar__group toolbar__group--view', isDenseSplitGroup('view') && 'is-split')}>
                {renderGroupActions('view')}
              </div>
            </>
          )}
        </div>

        {layoutMode === 'compact' && compactGroupOpen ? (
          <div className="toolbar-compact-panel">
            <div className="toolbar__group toolbar__group--compact">{renderGroupActions(compactGroupOpen)}</div>
          </div>
        ) : null}

        <div
          aria-hidden={!themePanelOpen}
          className={themePanelOpen ? 'theme-panel is-open' : 'theme-panel is-closed'}
        >
          <div className="theme-panel__section">
            <div className="theme-panel__title">{labels.appearanceMode}</div>
            <div className="theme-panel__modes">
              <button
                className={clsx('theme-mode-button', theme === 'system' && 'is-active')}
                onClick={() => {
                  onSetTheme('system');
                  setThemePanelOpen(false);
                }}
                type="button"
              >
                <Icon className="theme-mode-button__icon" name="autoTheme" />
                <span>{labels.auto}</span>
              </button>
              <button
                className={clsx('theme-mode-button', theme === 'light' && 'is-active')}
                onClick={() => {
                  onSetTheme('light');
                  setThemePanelOpen(false);
                }}
                type="button"
              >
                <Icon className="theme-mode-button__icon" name="sun" />
                <span>{labels.light}</span>
              </button>
              <button
                className={clsx('theme-mode-button', theme === 'dark' && 'is-active')}
                onClick={() => {
                  onSetTheme('dark');
                  setThemePanelOpen(false);
                }}
                type="button"
              >
                <Icon className="theme-mode-button__icon" name="moon" />
                <span>{labels.dark}</span>
              </button>
            </div>
          </div>

          <div className="theme-panel__section">
            <div className="theme-panel__title">{labels.paletteScheme}</div>
            <div className="theme-panel__palettes">
              {THEME_PALETTE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={clsx('theme-palette-button', themePalette === option.id && 'is-active')}
                  onClick={() => {
                    onSetThemePalette(option.id);
                    setThemePanelOpen(false);
                  }}
                  type="button"
                >
                  <span className="theme-palette-button__swatch" style={{ background: option.swatch }} />
                  <span className="theme-palette-button__label">{option.label}</span>
                  <span className="theme-palette-button__description">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <button
        aria-hidden={toolbarVisible}
        className={clsx('toolbar-reveal', toolbarVisible ? 'is-hidden' : 'is-visible')}
        data-tooltip={labels.showToolbar}
        onClick={onToggleToolbar}
        tabIndex={toolbarVisible ? -1 : 0}
        type="button"
      >
        <Icon className="toolbar-button__icon" name="menu" />
      </button>
    </>
  );
}

export default memo(Toolbar);
