import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageView from '../node-views/ImageView';

export interface EditableImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
  resolveImageSource: (src: string) => string;
}

export const EditableImage = Image.extend<EditableImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      resolveImageSource: (src: string) => src,
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView, {
      update: ({ oldNode, newNode, updateProps }) => {
        if (oldNode.type !== newNode.type) {
          return false;
        }

        const oldAttrs = oldNode.attrs ?? {};
        const newAttrs = newNode.attrs ?? {};
        const unchanged =
          oldAttrs.src === newAttrs.src &&
          oldAttrs.alt === newAttrs.alt &&
          oldAttrs.title === newAttrs.title;

        if (unchanged) {
          return true;
        }

        updateProps();
        return true;
      },
    });
  },
});
