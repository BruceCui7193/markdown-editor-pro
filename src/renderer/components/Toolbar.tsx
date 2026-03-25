import { memo, useEffect, useRef, useState, type ComponentProps } from 'react';
import clsx from 'clsx';
import type { Editor } from '@tiptap/react';
import type { ThemeMode } from '@shared/contracts';
import { THEME_PALETTE_OPTIONS, type ThemePalette } from '../theme';
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
  onClick: () => void;
  disabled?: boolean;
  title: string;
}

function ToolbarButton({
  icon,
  active = false,
  onClick,
  disabled = false,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      aria-label={title}
      className={clsx('toolbar-button', active && 'is-active')}
      data-tooltip={title}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      type="button"
    >
      <Icon className="toolbar-button__icon" name={icon} />
    </button>
  );
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
  const toolbarRef = useRef<HTMLElement | null>(null);
  const labels = {
    hideToolbar: '\u9690\u85cf\u5de5\u5177\u680f',
    hideSidebar: '\u9690\u85cf\u4fa7\u680f',
    showSidebar: '\u663e\u793a\u4fa7\u680f',
    newWindow: '\u65b0\u5efa\u7a97\u53e3',
    openFile: '\u6253\u5f00\u6587\u4ef6\uff08\u65b0\u7a97\u53e3\uff09',
    openFolder: '\u6253\u5f00\u6587\u4ef6\u5939\uff08\u65b0\u7a97\u53e3\uff09',
    save: '\u4fdd\u5b58',
    saveAs: '\u53e6\u5b58\u4e3a',
    findReplace: '\u67e5\u627e\u4e0e\u66ff\u6362',
    heading1: '\u4e00\u7ea7\u6807\u9898',
    heading2: '\u4e8c\u7ea7\u6807\u9898',
    bold: '\u52a0\u7c97',
    italic: '\u659c\u4f53',
    underline: '\u4e0b\u5212\u7ebf',
    strike: '\u5220\u9664\u7ebf',
    link: '\u94fe\u63a5',
    quote: '\u5f15\u7528',
    bullet: '\u65e0\u5e8f\u5217\u8868',
    ordered: '\u6709\u5e8f\u5217\u8868',
    task: '\u4efb\u52a1\u5217\u8868',
    table: '\u63d2\u5165\u8868\u683c',
    code: '\u4ee3\u7801\u5757',
    math: '\u63d2\u5165\u516c\u5f0f',
    mermaid: '\u63d2\u5165 Mermaid \u56fe\u8868',
    image: '\u63d2\u5165\u56fe\u7247',
    footnote: '\u63d2\u5165\u811a\u6ce8',
    sourceOn: '\u5207\u56de\u6240\u89c1\u5373\u6240\u5f97\u6a21\u5f0f',
    sourceOff: '\u5207\u6362\u5230\u6e90\u7801\u6a21\u5f0f',
    themePanel: '\u4e3b\u9898\u4e0e\u914d\u8272',
    showToolbar: '\u663e\u793a\u5de5\u5177\u680f',
    appearanceMode: '\u5916\u89c2\u6a21\u5f0f',
    paletteScheme: '\u914d\u8272\u65b9\u6848',
    auto: '\u81ea\u52a8',
    light: '\u6d45\u8272',
    dark: '\u6df1\u8272',
    linkPrompt: '\u8f93\u5165\u94fe\u63a5\u5730\u5740',
    mathPrompt: '\u8f93\u5165 LaTeX \u516c\u5f0f',
    footnotePrompt: '\u8f93\u5165\u811a\u6ce8\u7f16\u53f7',
  };
  const themeLabel =
    theme === 'system'
      ? '\u4e3b\u9898\uff1a\u81ea\u52a8'
      : theme === 'light'
        ? '\u4e3b\u9898\uff1a\u6d45\u8272'
        : '\u4e3b\u9898\uff1a\u6df1\u8272';
  const currentPalette = THEME_PALETTE_OPTIONS.find((option) => option.id === themePalette);

  useEffect(() => {
    if (!themePanelOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setThemePanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setThemePanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [themePanelOpen]);

  return (
    <>
      {toolbarVisible ? (
        <header className="toolbar" ref={toolbarRef}>
          <div className="toolbar__row">
            <div className="toolbar__group toolbar__group--file">
              <ToolbarButton icon="menu" onClick={onToggleToolbar} title={labels.hideToolbar} />
              <ToolbarButton
                active={sidebarVisible}
                icon="sidebar"
                onClick={onToggleSidebar}
                title={sidebarVisible ? labels.hideSidebar : labels.showSidebar}
              />
              <ToolbarButton icon="newWindow" onClick={onNewWindow} title={labels.newWindow} />
              <ToolbarButton icon="open" onClick={onOpen} title={labels.openFile} />
              <ToolbarButton icon="folder" onClick={onOpenFolder} title={labels.openFolder} />
              <ToolbarButton icon="save" onClick={onSave} title={labels.save} />
              <ToolbarButton icon="saveAs" onClick={onSaveAs} title={labels.saveAs} />
              <ToolbarButton
                active={searchVisible}
                icon="search"
                onClick={() => onOpenSearch(true)}
                title={labels.findReplace}
              />
            </div>

            <div className="toolbar__divider" />

            <div className="toolbar__group toolbar__group--format">
              <ToolbarButton
                active={editor?.isActive('heading', { level: 1 })}
                disabled={!editor || sourceMode}
                icon="heading1"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                title={labels.heading1}
              />
              <ToolbarButton
                active={editor?.isActive('heading', { level: 2 })}
                disabled={!editor || sourceMode}
                icon="heading2"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                title={labels.heading2}
              />
              <ToolbarButton
                active={editor?.isActive('bold')}
                disabled={!editor || sourceMode}
                icon="bold"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                title={labels.bold}
              />
              <ToolbarButton
                active={editor?.isActive('italic')}
                disabled={!editor || sourceMode}
                icon="italic"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                title={labels.italic}
              />
              <ToolbarButton
                active={editor?.isActive('underline')}
                disabled={!editor || sourceMode}
                icon="underline"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                title={labels.underline}
              />
              <ToolbarButton
                active={editor?.isActive('strike')}
                disabled={!editor || sourceMode}
                icon="strike"
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                title={labels.strike}
              />
              <ToolbarButton
                active={editor?.isActive('link')}
                disabled={!editor || sourceMode}
                icon="link"
                onClick={() => {
                  if (!editor) {
                    return;
                  }

                  const previous = editor.getAttributes('link').href as string | undefined;
                  const href = window.prompt(labels.linkPrompt, previous ?? 'https://');
                  if (!href) {
                    return;
                  }

                  editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
                }}
                title={labels.link}
              />
              <ToolbarButton
                active={editor?.isActive('blockquote')}
                disabled={!editor || sourceMode}
                icon="quote"
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                title={labels.quote}
              />
              <ToolbarButton
                active={editor?.isActive('bulletList')}
                disabled={!editor || sourceMode}
                icon="bullet"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                title={labels.bullet}
              />
              <ToolbarButton
                active={editor?.isActive('orderedList')}
                disabled={!editor || sourceMode}
                icon="ordered"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                title={labels.ordered}
              />
              <ToolbarButton
                active={editor?.isActive('taskList')}
                disabled={!editor || sourceMode}
                icon="task"
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
                title={labels.task}
              />
              <ToolbarButton
                disabled={!editor || sourceMode}
                icon="table"
                onClick={() =>
                  editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
                title={labels.table}
              />
              <ToolbarButton
                active={editor?.isActive('codeBlock')}
                disabled={!editor || sourceMode}
                icon="code"
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                title={labels.code}
              />
              <ToolbarButton
                disabled={!editor || sourceMode}
                icon="math"
                onClick={() => {
                  if (!editor) {
                    return;
                  }

                  const value = window.prompt(labels.mathPrompt, 'E = mc^2');
                  if (value === null) {
                    return;
                  }

                  editor.chain().focus().insertMathBlock(value).run();
                }}
                title={labels.math}
              />
              <ToolbarButton
                disabled={!editor || sourceMode}
                icon="diagram"
                onClick={() =>
                  editor?.chain().focus().insertMermaidBlock('graph TD\n  A[Write] --> B[Preview]').run()
                }
                title={labels.mermaid}
              />
              <ToolbarButton
                disabled={!editor || sourceMode}
                icon="image"
                onClick={onInsertImage}
                title={labels.image}
              />
              <ToolbarButton
                disabled={!editor || sourceMode}
                icon="footnote"
                onClick={() => {
                  if (!editor) {
                    return;
                  }

                  const label = window.prompt(labels.footnotePrompt, '1');
                  if (!label) {
                    return;
                  }

                  editor.chain().focus().insertFootnoteReference(label).run();
                  editor
                    .chain()
                    .focus()
                    .insertContent({ type: 'paragraph' })
                    .insertFootnoteDefinition(label)
                    .run();
                }}
                title={labels.footnote}
              />
            </div>

            <div className="toolbar__divider" />

            <div className="toolbar__group toolbar__group--mode">
              <ToolbarButton
                active={sourceMode}
                icon="source"
                onClick={onToggleSourceMode}
                title={sourceMode ? labels.sourceOn : labels.sourceOff}
              />
              <ToolbarButton
                active={themePanelOpen || theme !== 'system'}
                icon="appearance"
                onClick={() => setThemePanelOpen((current) => !current)}
                title={`${labels.themePanel} / ${themeLabel} / ${currentPalette?.label ?? labels.auto}`}
              />
            </div>
          </div>

          {themePanelOpen ? (
            <div className="theme-panel">
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
                      <span
                        className="theme-palette-button__swatch"
                        style={{ background: option.swatch }}
                      />
                      <span className="theme-palette-button__label">{option.label}</span>
                      <span className="theme-palette-button__description">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </header>
      ) : (
        <button
          className="toolbar-reveal"
          data-tooltip={labels.showToolbar}
          onClick={onToggleToolbar}
          type="button"
        >
          <Icon className="toolbar-button__icon" name="menu" />
        </button>
      )}
    </>
  );
}

export default memo(Toolbar);
