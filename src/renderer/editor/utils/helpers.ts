import type { DocumentStats } from '../../App';

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function countDocumentWords(text: string): number {
  const cjkMatches =
    text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [];
  const latinMatches = text.match(/[A-Za-z0-9]+(?:[._'-][A-Za-z0-9]+)*/g) ?? [];

  return cjkMatches.length + latinMatches.length;
}

export function calculateDocumentStats(text: string): DocumentStats {
  const normalized = text.replace(/\r/g, '');
  const words = countDocumentWords(normalized);
  const characters = Array.from(normalized).length;
  const lines = normalized === '' ? 1 : normalized.split('\n').length;

  return {
    words,
    characters,
    lines,
  };
}
