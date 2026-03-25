import { existsSync } from 'node:fs';
import path from 'node:path';

function resolveOptionalBuildIcon(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return existsSync(absolutePath) ? absolutePath : undefined;
}

function createMarkdownFileAssociation(ext, iconRelativePath) {
  const icon = resolveOptionalBuildIcon(iconRelativePath);

  return {
    ext,
    name: 'Markdown Document',
    description: 'Open Markdown files with Markdown Editor Pro',
    role: 'Editor',
    ...(icon ? { icon } : {}),
  };
}

export default {
  appId: 'com.crh.markdowneditorpro',
  productName: 'Markdown Editor Pro',
  executableName: 'markdown-editor-pro',
  directories: {
    buildResources: 'build',
  },
  files: ['out/**', 'package.json'],
  asar: true,
  compression: 'maximum',
  npmRebuild: false,
  win: {
    target: ['nsis'],
    fileAssociations: [
      createMarkdownFileAssociation('md', 'build/file-associations/md.ico'),
      createMarkdownFileAssociation('markdown', 'build/file-associations/markdown.ico'),
    ],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
};
