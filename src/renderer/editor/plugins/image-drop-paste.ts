import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

function clipboardContainsStructuredTable(event: ClipboardEvent): boolean {
  const html = event.clipboardData?.getData('text/html') ?? '';
  if (/<table[\s>]/i.test(html)) {
    return true;
  }

  const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\r\n/g, '\n');
  const rows = text
    .split('\n')
    .map((row) => row.trimEnd())
    .filter((row) => row.length > 0);

  return rows.length >= 2 && rows.every((row) => row.includes('\t'));
}

export function createImageDropPasteExtension(onUploadImage: (file: File) => Promise<string>) {
  return Extension.create({
    name: 'imageDropPaste',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handlePaste: (view, event) => {
              const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
                file.type.startsWith('image/'),
              );

              if (files.length === 0 || clipboardContainsStructuredTable(event)) {
                return false;
              }

              event.preventDefault();

              void (async () => {
                for (const file of files) {
                  const src = await onUploadImage(file);
                  const node = view.state.schema.nodes.image?.create({
                    src,
                    alt: '',
                    title: null,
                  });

                  if (!node) {
                    continue;
                  }

                  const transaction = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(transaction.scrollIntoView());
                }
              })();

              return true;
            },
            handleDrop: (view, event) => {
              const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
                file.type.startsWith('image/'),
              );

              if (files.length === 0) {
                return false;
              }

              event.preventDefault();
              const coordinates = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              const dropPosition = coordinates?.pos ?? view.state.selection.from;

              void (async () => {
                let offset = 0;

                for (const file of files) {
                  const src = await onUploadImage(file);
                  const node = view.state.schema.nodes.image?.create({
                    src,
                    alt: '',
                    title: null,
                  });

                  if (!node) {
                    continue;
                  }

                  const transaction = view.state.tr.insert(dropPosition + offset, node);
                  offset += node.nodeSize;
                  view.dispatch(transaction.scrollIntoView());
                }
              })();

              return true;
            },
          },
        }),
      ];
    },
  });
}
