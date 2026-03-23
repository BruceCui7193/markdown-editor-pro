import type { FolderEntry } from '@shared/contracts';

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

export function getDirectoryPath(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? null : filePath.slice(0, index);
}

export function extractOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split(/\r?\n/);
  const items: OutlineItem[] = [];

  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line.trim());
    if (!match) {
      return;
    }

    items.push({
      id: `heading-${index}-${items.length}`,
      level: match[1].length,
      text: match[2],
    });
  });

  return items;
}

export function formatFolderDate(timestamp: number): string {
  const now = Date.now();
  const diffDays = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return '\u4eca\u5929';
  }

  if (diffDays === 1) {
    return '\u6628\u5929';
  }

  if (diffDays < 7) {
    return `${diffDays} \u5929\u524d`;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(timestamp);
}

export function sortFolderEntries(entries: FolderEntry[]): FolderEntry[] {
  return [...entries].sort((left, right) => right.modifiedAt - left.modifiedAt);
}
