import clsx from 'clsx';
import type { FolderEntry } from '@shared/contracts';
import type { OutlineItem } from '../utils/document';
import { formatFolderDate } from '../utils/document';

type SidebarTab = 'files' | 'outline';

interface SidebarProps {
  visible: boolean;
  tab: SidebarTab;
  currentFilePath: string | null;
  folderPath: string | null;
  folderEntries: FolderEntry[];
  outline: OutlineItem[];
  onSelectTab: (tab: SidebarTab) => void;
  onOpenFolder: () => void;
  onOpenFile: (filePath: string) => void;
  onNavigateOutline: (index: number) => void;
}

export default function Sidebar({
  visible,
  tab,
  currentFilePath,
  folderPath,
  folderEntries,
  outline,
  onSelectTab,
  onOpenFolder,
  onOpenFile,
  onNavigateOutline,
}: SidebarProps) {
  return (
    <aside className={clsx('sidebar', !visible && 'is-hidden')}>
      <div className="sidebar__tabs">
        <button
          className={clsx('sidebar__tab', tab === 'files' && 'is-active')}
          onClick={() => onSelectTab('files')}
          type="button"
        >
          {'\u6587\u4ef6'}
        </button>
        <button
          className={clsx('sidebar__tab', tab === 'outline' && 'is-active')}
          onClick={() => onSelectTab('outline')}
          type="button"
        >
          {'\u5927\u7eb2'}
        </button>
      </div>

      {tab === 'files' ? (
        <div className="sidebar__panel">
          <div className="sidebar__panel-header">
            <div className="sidebar__panel-title">{'\u6587\u4ef6\u5939'}</div>
            <button className="sidebar__action" onClick={onOpenFolder} type="button">
              {'\u6253\u5f00'}
            </button>
          </div>

          {folderPath ? <div className="sidebar__path">{folderPath}</div> : null}

          <div className="sidebar__list">
            {folderEntries.length > 0 ? (
              folderEntries.map((entry) => (
                <button
                  key={entry.path}
                  className={clsx('file-item', currentFilePath === entry.path && 'is-active')}
                  onClick={() => onOpenFile(entry.path)}
                  type="button"
                >
                  <div className="file-item__meta">
                    <span className="file-item__kind">Markdown</span>
                    <span className="file-item__date">{formatFolderDate(entry.modifiedAt)}</span>
                  </div>
                  <div className="file-item__title">{entry.title}</div>
                  <div className="file-item__path">{entry.path}</div>
                </button>
              ))
            ) : (
              <div className="sidebar__empty">
                {'\u6253\u5f00\u4e00\u4e2a\u6587\u4ef6\u5939\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u5176\u4e2d\u7684 Markdown \u6587\u4ef6\u3002'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="sidebar__panel">
          <div className="sidebar__panel-header">
            <div className="sidebar__panel-title">{'\u6587\u6863\u5927\u7eb2'}</div>
          </div>

          <div className="sidebar__list">
            {outline.length > 0 ? (
              outline.map((item, index) => (
                <button
                  key={item.id}
                  className={`outline-item level-${item.level}`}
                  onClick={() => onNavigateOutline(index)}
                  type="button"
                >
                  {item.text}
                </button>
              ))
            ) : (
              <div className="sidebar__empty">
                {'\u5f53\u524d\u6587\u6863\u8fd8\u6ca1\u6709\u6807\u9898\u7ed3\u6784\u3002'}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
