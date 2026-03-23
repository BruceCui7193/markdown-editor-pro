# markdown-editor-pro

`markdown-editor-pro` 是一个面向桌面场景的所见即所得（WYSIWYG）Markdown 编辑器，使用 Electron、React、TypeScript、Vite 和 Tiptap 构建。

项目目标不是简单实现 Markdown 渲染，而是提供一套更接近成熟桌面编辑器的使用体验，包括实时编辑、数学公式、Mermaid、文件夹浏览、多窗口、主题切换、导出能力和 Windows 集成。

## 主要功能

- 所见即所得编辑，不使用传统分栏预览
- 支持常用 Markdown 语法：标题、列表、任务列表、引用、表格、代码块、图片、链接、脚注等
- 支持数学公式：`$...$`、`$$...$$`、`\(...\)`、`\[...\]`
- 支持 Mermaid 图表渲染与单击编辑
- 支持源码模式
- 支持图片拖拽、粘贴和本地资源落盘
- 支持打开文件夹，并在侧栏查看当前目录中的 Markdown 文件
- 支持文档大纲侧栏
- 支持浅色、深色、跟随系统以及多套配色方案
- 支持多窗口
- 支持未保存修改保护
- 支持记住上次窗口大小、位置和最大化状态
- 支持导出 PDF
- 支持导出整篇图片长图，并显示导出进度
- 支持 Windows 文件关联，可将 `.md` / `.markdown` 文件默认关联到本应用

## 技术栈

- Electron
- electron-vite
- React
- TypeScript
- Tiptap / ProseMirror
- unified / remark-parse / remark-gfm / remark-math / remark-stringify
- KaTeX
- Mermaid
- lowlight
- pngjs

## 目录结构

```text
src/
  main/        Electron 主进程与桌面集成逻辑
  preload/     IPC 桥接层
  renderer/    React 界面、编辑器逻辑与样式
  shared/      主进程与渲染进程共享类型
build/         图标等打包资源
```

## 环境要求

- Node.js 20 及以上
- npm 10 及以上
- Windows 10 / 11

## 安装依赖

```bash
npm install
```

如果你是从旧版本代码更新到最新版本，建议重新执行一次 `npm install`，确保新增依赖已经安装完成。

## 开发运行

```bash
npm run dev
```

## 构建应用

```bash
npm run build
```

如果只想生成目录版产物用于本地测试，可以执行：

```bash
npm run build:dir
```

## 构建产物

构建完成后，常见产物位于 `dist/` 目录：

- `dist/win-unpacked/`：目录版应用
- `dist/*.exe`：Windows 安装包

## 文件关联

`.md` 和 `.markdown` 文件关联配置位于 [electron-builder.yml](D:\Program Files\MarkdownEditor\electron-builder.yml)。

安装完成后，Windows 中可将 Markdown 文件默认打开方式设置为本应用。

## 开发说明

- 应用图标默认读取 `build/icon.ico`
- PDF 与图片导出由主进程负责
- 图片导出采用分段截图后拼接的方式，较大的文档导出会比普通保存更慢
- 如果修改了依赖，请同步更新锁文件后再提交
