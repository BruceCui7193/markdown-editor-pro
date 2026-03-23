import type { JSONContent } from '@tiptap/core';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';

type MarkdownNode = Record<string, any>;

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath, { singleDollarTextMath: true });
const compiler = unified()
  .use(remarkStringify, {
    bullet: '-',
    fences: true,
    incrementListMarker: false,
    listItemIndent: 'one',
    strong: '*',
  })
  .use(remarkGfm)
  .use(remarkMath, { singleDollarTextMath: true });

interface DefinitionContext {
  definitions: Map<string, MarkdownNode>;
}

function normalizeMathDelimiters(markdown: string): string {
  const placeholders: string[] = [];

  const protect = (pattern: RegExp, input: string): string =>
    input.replace(pattern, (match) => {
      const token = `@@MARKDOWN_EDITOR_TOKEN_${placeholders.length}@@`;
      placeholders.push(match);
      return token;
    });

  let normalized = markdown;
  normalized = protect(/```[\s\S]*?```/g, normalized);
  normalized = protect(/~~~[\s\S]*?~~~/g, normalized);
  normalized = protect(/`[^`\n]+`/g, normalized);
  normalized = normalizeBlockMathPairs(normalized, '\\[', '\\]');
  normalized = normalizeBlockMathPairs(normalized, '$$', '$$');
  normalized = normalized.replace(/\\\((.+?)\\\)/gs, (_match, expression) => {
    return `$${String(expression).trim()}$`;
  });

  return normalized.replace(/@@MARKDOWN_EDITOR_TOKEN_(\d+)@@/g, (_match, index) => {
    return placeholders[Number(index)] ?? '';
  });
}

function normalizeBlockMathPairs(markdown: string, open: string, close: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < markdown.length) {
    if (!markdown.startsWith(open, cursor)) {
      result += markdown[cursor];
      cursor += 1;
      continue;
    }

    const closeIndex = markdown.indexOf(close, cursor + open.length);
    if (closeIndex === -1) {
      result += markdown[cursor];
      cursor += 1;
      continue;
    }

    const expression = markdown.slice(cursor + open.length, closeIndex).trim();
    const needsLeadingBreak = result.length > 0 && !result.endsWith('\n');
    const needsTrailingBreak =
      closeIndex + close.length < markdown.length && markdown[closeIndex + close.length] !== '\n';

    result += `${needsLeadingBreak ? '\n' : ''}$$\n${expression}\n$$${needsTrailingBreak ? '\n' : ''}`;
    cursor = closeIndex + close.length;
  }

  return result;
}

function collectDefinitions(root: MarkdownNode): DefinitionContext {
  const definitions = new Map<string, MarkdownNode>();

  for (const child of root.children ?? []) {
    if (child.type === 'definition' && child.identifier) {
      definitions.set(String(child.identifier).toLowerCase(), child);
    }
  }

  return { definitions };
}

function markify(content: JSONContent[], mark: NonNullable<JSONContent['marks']>[number]): JSONContent[] {
  return content.map((node) => {
    if (node.type === 'text') {
      return {
        ...node,
        marks: [...(node.marks ?? []), mark],
      };
    }

    return node;
  });
}

function inlineChildrenToTiptap(children: MarkdownNode[], context: DefinitionContext): JSONContent[] {
  return children.flatMap((child) => inlineToTiptap(child, context));
}

function inlineToTiptap(node: MarkdownNode, context: DefinitionContext): JSONContent[] {
  switch (node.type) {
    case 'text':
      return node.value ? [{ type: 'text', text: String(node.value) }] : [];
    case 'inlineCode':
      return node.value
        ? [
            {
              type: 'text',
              text: String(node.value),
              marks: [{ type: 'code' }],
            },
          ]
        : [];
    case 'break':
      return [{ type: 'hardBreak' }];
    case 'strong':
      return markify(inlineChildrenToTiptap(node.children ?? [], context), { type: 'bold' });
    case 'emphasis':
      return markify(inlineChildrenToTiptap(node.children ?? [], context), { type: 'italic' });
    case 'delete':
      return markify(inlineChildrenToTiptap(node.children ?? [], context), { type: 'strike' });
    case 'link':
      return markify(inlineChildrenToTiptap(node.children ?? [], context), {
        type: 'link',
        attrs: {
          href: node.url,
          title: node.title ?? null,
        },
      });
    case 'linkReference': {
      const definition = context.definitions.get(String(node.identifier).toLowerCase());
      if (!definition) {
        return [{ type: 'text', text: String(node.label ?? node.identifier ?? '') }];
      }

      return markify(inlineChildrenToTiptap(node.children ?? [], context), {
        type: 'link',
        attrs: {
          href: definition.url,
          title: definition.title ?? null,
        },
      });
    }
    case 'image':
      return [
        {
          type: 'image',
          attrs: {
            src: node.url,
            alt: node.alt ?? '',
            title: node.title ?? null,
          },
        },
      ];
    case 'imageReference': {
      const definition = context.definitions.get(String(node.identifier).toLowerCase());
      if (!definition) {
        return [];
      }

      return [
        {
          type: 'image',
          attrs: {
            src: definition.url,
            alt: node.alt ?? node.identifier ?? '',
            title: definition.title ?? null,
          },
        },
      ];
    }
    case 'inlineMath':
      return [
        {
          type: 'mathInline',
          attrs: {
            value: String(node.value ?? ''),
          },
        },
      ];
    case 'footnoteReference':
      return [
        {
          type: 'footnoteReference',
          attrs: {
            label: String(node.label ?? node.identifier ?? ''),
          },
        },
      ];
    case 'html':
      return node.value ? [{ type: 'text', text: String(node.value) }] : [];
    default:
      return [];
  }
}

function tableCellToNode(
  cell: MarkdownNode,
  type: 'tableCell' | 'tableHeader',
  context: DefinitionContext,
): JSONContent {
  const content = inlineChildrenToTiptap(cell.children ?? [], context);

  return {
    type,
    content: [
      {
        type: 'paragraph',
        content,
      },
    ],
  };
}

function flowChildrenToTiptap(children: MarkdownNode[], context: DefinitionContext): JSONContent[] {
  return children
    .filter((child) => child.type !== 'definition')
    .flatMap((child) => flowToTiptap(child, context));
}

function flowToTiptap(node: MarkdownNode, context: DefinitionContext): JSONContent[] {
  switch (node.type) {
    case 'paragraph': {
      const content = inlineChildrenToTiptap(node.children ?? [], context);

      if (content.length === 1 && content[0].type === 'image') {
        return content;
      }

      return [{ type: 'paragraph', content }];
    }
    case 'heading':
      return [
        {
          type: 'heading',
          attrs: { level: node.depth ?? 1 },
          content: inlineChildrenToTiptap(node.children ?? [], context),
        },
      ];
    case 'blockquote':
      return [
        {
          type: 'blockquote',
          content: flowChildrenToTiptap(node.children ?? [], context),
        },
      ];
    case 'list': {
      const isTaskList = (node.children ?? []).some(
        (child: MarkdownNode) => child.checked !== null && child.checked !== undefined,
      );

      return [
        {
          type: isTaskList ? 'taskList' : node.ordered ? 'orderedList' : 'bulletList',
          attrs: node.ordered ? { start: node.start ?? 1 } : undefined,
          content: (node.children ?? []).map((child: MarkdownNode) => ({
            type: isTaskList ? 'taskItem' : 'listItem',
            attrs: isTaskList ? { checked: Boolean(child.checked) } : undefined,
            content: flowChildrenToTiptap(child.children ?? [], context),
          })),
        },
      ];
    }
    case 'code':
      if (String(node.lang ?? '').toLowerCase() === 'mermaid') {
        return [
          {
            type: 'mermaidBlock',
            attrs: {
              code: String(node.value ?? ''),
            },
          },
        ];
      }

      return [
        {
          type: 'codeBlock',
          attrs: {
            language: node.lang ?? null,
          },
          content: node.value ? [{ type: 'text', text: String(node.value) }] : [],
        },
      ];
    case 'math':
      return [
        {
          type: 'mathBlock',
          attrs: {
            value: String(node.value ?? ''),
          },
        },
      ];
    case 'table':
      return [
        {
          type: 'table',
          content: (node.children ?? []).map((row: MarkdownNode, index: number) => ({
            type: 'tableRow',
            content: (row.children ?? []).map((cell: MarkdownNode) =>
              tableCellToNode(cell, index === 0 ? 'tableHeader' : 'tableCell', context),
            ),
          })),
        },
      ];
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }];
    case 'footnoteDefinition':
      return [
        {
          type: 'footnoteDefinition',
          attrs: {
            label: String(node.label ?? node.identifier ?? ''),
          },
          content: flowChildrenToTiptap(node.children ?? [], context),
        },
      ];
    case 'html':
      return [
        {
          type: 'paragraph',
          content: node.value ? [{ type: 'text', text: String(node.value) }] : [],
        },
      ];
    default:
      return [];
  }
}

function applyTextMarks(text: string, marks: NonNullable<JSONContent['marks']> = []): MarkdownNode {
  const codeMark = marks.find((mark) => mark.type === 'code');
  if (codeMark) {
    return { type: 'inlineCode', value: text };
  }

  let current: MarkdownNode = { type: 'text', value: text };
  for (const mark of marks) {
    if (mark.type === 'bold') {
      current = { type: 'strong', children: [current] };
    } else if (mark.type === 'italic') {
      current = { type: 'emphasis', children: [current] };
    } else if (mark.type === 'strike') {
      current = { type: 'delete', children: [current] };
    } else if (mark.type === 'link') {
      current = {
        type: 'link',
        url: mark.attrs?.href ?? '',
        title: mark.attrs?.title ?? null,
        children: [current],
      };
    }
  }

  return current;
}

function inlineToMarkdown(node: JSONContent): MarkdownNode[] {
  switch (node.type) {
    case 'text':
      return node.text ? [applyTextMarks(node.text, node.marks ?? [])] : [];
    case 'hardBreak':
      return [{ type: 'break' }];
    case 'image':
      return [
        {
          type: 'image',
          url: node.attrs?.src ?? '',
          alt: node.attrs?.alt ?? '',
          title: node.attrs?.title ?? null,
        },
      ];
    case 'mathInline':
      return [{ type: 'inlineMath', value: node.attrs?.value ?? '' }];
    case 'footnoteReference':
      return [
        {
          type: 'footnoteReference',
          identifier: node.attrs?.label ?? '',
          label: node.attrs?.label ?? '',
        },
      ];
    default:
      return [];
  }
}

function inlineChildrenToMarkdown(children: JSONContent[] = []): MarkdownNode[] {
  return children.flatMap((child) => inlineToMarkdown(child));
}

function flattenCell(children: JSONContent[] = []): MarkdownNode[] {
  const result: MarkdownNode[] = [];

  children.forEach((child, index) => {
    if (index > 0) {
      result.push({ type: 'break' });
    }

    if (child.type === 'paragraph') {
      result.push(...inlineChildrenToMarkdown(child.content));
      return;
    }

    result.push(...inlineToMarkdown(child));
  });

  return result.length > 0 ? result : [{ type: 'text', value: '' }];
}

function flowChildrenToMarkdown(children: JSONContent[] = []): MarkdownNode[] {
  return children.flatMap((child) => flowToMarkdown(child));
}

function flowToMarkdown(node: JSONContent): MarkdownNode[] {
  switch (node.type) {
    case 'paragraph':
      return [{ type: 'paragraph', children: inlineChildrenToMarkdown(node.content) }];
    case 'heading':
      return [
        {
          type: 'heading',
          depth: node.attrs?.level ?? 1,
          children: inlineChildrenToMarkdown(node.content),
        },
      ];
    case 'blockquote':
      return [{ type: 'blockquote', children: flowChildrenToMarkdown(node.content) }];
    case 'bulletList':
      return [
        {
          type: 'list',
          ordered: false,
          spread: false,
          children: (node.content ?? []).map((item) => ({
            type: 'listItem',
            spread: false,
            children: flowChildrenToMarkdown(item.content),
          })),
        },
      ];
    case 'orderedList':
      return [
        {
          type: 'list',
          ordered: true,
          start: node.attrs?.start ?? 1,
          spread: false,
          children: (node.content ?? []).map((item) => ({
            type: 'listItem',
            spread: false,
            children: flowChildrenToMarkdown(item.content),
          })),
        },
      ];
    case 'taskList':
      return [
        {
          type: 'list',
          ordered: false,
          spread: false,
          children: (node.content ?? []).map((item) => ({
            type: 'listItem',
            checked: Boolean(item.attrs?.checked),
            spread: false,
            children: flowChildrenToMarkdown(item.content),
          })),
        },
      ];
    case 'codeBlock':
      return [
        {
          type: 'code',
          lang: node.attrs?.language ?? null,
          value: node.content?.map((child) => child.text ?? '').join('') ?? '',
        },
      ];
    case 'mathBlock':
      return [{ type: 'math', value: node.attrs?.value ?? '' }];
    case 'mermaidBlock':
      return [{ type: 'code', lang: 'mermaid', value: node.attrs?.code ?? '' }];
    case 'horizontalRule':
      return [{ type: 'thematicBreak' }];
    case 'image':
      return [{ type: 'paragraph', children: inlineToMarkdown(node) }];
    case 'table':
      return [
        {
          type: 'table',
          align: (node.content?.[0]?.content ?? []).map(() => null),
          children: (node.content ?? []).map((row) => ({
            type: 'tableRow',
            children: (row.content ?? []).map((cell) => ({
              type: 'tableCell',
              children: flattenCell(cell.content),
            })),
          })),
        },
      ];
    case 'footnoteDefinition':
      return [
        {
          type: 'footnoteDefinition',
          identifier: node.attrs?.label ?? '',
          label: node.attrs?.label ?? '',
          children: flowChildrenToMarkdown(node.content),
        },
      ];
    default:
      return [];
  }
}

export function parseMarkdown(markdown: string): JSONContent {
  const normalized = normalizeMathDelimiters(markdown);
  const tree = parser.parse(normalized) as MarkdownNode;
  const context = collectDefinitions(tree);

  return {
    type: 'doc',
    content: flowChildrenToTiptap(tree.children ?? [], context),
  };
}

export function serializeMarkdown(document: JSONContent): string {
  const tree = {
    type: 'root',
    children: flowChildrenToMarkdown(document.content),
  };

  const serialized = String(compiler.stringify(tree as MarkdownNode)).trimEnd();
  return serialized.length === 0 ? '' : `${serialized}\n`;
}
