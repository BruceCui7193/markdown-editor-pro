export type ThemePalette = 'natural' | 'forest' | 'ocean' | 'sepia' | 'graphite';

export interface ThemePaletteOption {
  id: ThemePalette;
  label: string;
  description: string;
  swatch: string;
}

export const THEME_PALETTE_OPTIONS: ThemePaletteOption[] = [
  {
    id: 'natural',
    label: '\u81ea\u7136',
    description: '\u67d4\u548c\u7684\u7c73\u767d\u4e0e\u82d4\u7eff',
    swatch: 'linear-gradient(135deg, #f6f1e6 0%, #7ba48f 100%)',
  },
  {
    id: 'forest',
    label: '\u68ee\u6797',
    description: '\u66f4\u6df1\u4e00\u4e9b\u7684\u7eff\u8c03',
    swatch: 'linear-gradient(135deg, #e7efe8 0%, #3f6f5f 100%)',
  },
  {
    id: 'ocean',
    label: '\u6d77\u6e7e',
    description: '\u6e05\u723d\u7684\u84dd\u7070\u6c14\u8d28',
    swatch: 'linear-gradient(135deg, #edf3f8 0%, #4d7592 100%)',
  },
  {
    id: 'sepia',
    label: '\u6696\u7eb8',
    description: '\u63a5\u8fd1\u7eb8\u5f20\u7684\u6696\u8c03',
    swatch: 'linear-gradient(135deg, #f6ead7 0%, #9a6e45 100%)',
  },
  {
    id: 'graphite',
    label: '\u77f3\u58a8',
    description: '\u66f4\u4e2d\u6027\u7684\u7070\u9636\u914d\u8272',
    swatch: 'linear-gradient(135deg, #eceef0 0%, #56606b 100%)',
  },
];

export function isThemePalette(value: string | null): value is ThemePalette {
  return THEME_PALETTE_OPTIONS.some((option) => option.id === value);
}
