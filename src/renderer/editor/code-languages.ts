export interface CodeLanguageOption {
  value: string;
  label: string;
}

export const CODE_LANGUAGE_OPTIONS: CodeLanguageOption[] = [
  { value: '', label: 'Plain Text' },
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'json', label: 'JSON' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'xml', label: 'XML / SVG' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
];

export function getCodeLanguageLabel(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return (
    CODE_LANGUAGE_OPTIONS.find((option) => option.value.toLowerCase() === normalized)?.label ??
    (normalized || 'Plain Text')
  );
}
