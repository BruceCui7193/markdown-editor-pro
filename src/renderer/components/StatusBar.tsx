import type { DocumentStats } from '../App';

interface StatusBarProps {
  stats: DocumentStats;
  dirty: boolean;
  title: string;
  lastSavedAt: number | null;
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) {
    return '\u5c1a\u672a\u4fdd\u5b58';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export default function StatusBar({
  stats,
  dirty,
  title,
  lastSavedAt,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span>{dirty ? '\u672a\u4fdd\u5b58\u4fee\u6539' : '\u5df2\u4fdd\u5b58'}</span>
        <span>{title}</span>
      </div>
      <div className="status-bar__right">
        <span>{stats.words} {'\u5b57'}</span>
        <span>{formatTime(lastSavedAt)}</span>
      </div>
    </footer>
  );
}
