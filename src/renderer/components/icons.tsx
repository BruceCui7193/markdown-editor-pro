import type { ReactElement, SVGProps } from 'react';

type IconName =
  | 'menu'
  | 'newWindow'
  | 'open'
  | 'folder'
  | 'save'
  | 'saveAs'
  | 'search'
  | 'sidebar'
  | 'heading1'
  | 'heading2'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'link'
  | 'quote'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'table'
  | 'code'
  | 'math'
  | 'diagram'
  | 'image'
  | 'footnote'
  | 'source'
  | 'appearance'
  | 'sun'
  | 'moon'
  | 'autoTheme';

const iconPaths: Record<IconName, ReactElement> = {
  menu: (
    <path
      d="M4 7h16M4 12h16M4 17h16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  ),
  newWindow: (
    <>
      <path d="M5 5h9v9H5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 10h5v9h-9v-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  open: (
    <path
      d="M4 18V7h5l2 2h9v9zM12 12l3-3 3 3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  folder: (
    <path
      d="M4 18V7h5l2 2h9v9z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  save: (
    <path
      d="M5 5h11l3 3v11H5zM8 5v5h7V5M8 19v-5h8v5"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  sidebar: (
    <path
      d="M4 6h16v12H4zM9 6v12"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  saveAs: (
    <>
      <path
        d="M5 5h11l3 3v11H5zM8 5v5h7V5M8 19v-5h8v5"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M12 12h6M15 9v6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.2 15.2L19 19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </>
  ),
  heading1: (
    <path
      d="M5 6v12M12 6v12M5 12h7M17 10l2-2v10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  heading2: (
    <path
      d="M5 6v12M12 6v12M5 12h7M16.5 10c.5-1 1.2-2 2.5-2 1.1 0 2 .8 2 1.9 0 1.1-.7 1.8-1.6 2.4L17 14h4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  ),
  bold: <path d="M8 6h5a3 3 0 010 6H8zm0 6h6a3 3 0 010 6H8z" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  italic: <path d="M13 5h6M5 19h6M14 5L10 19" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />,
  underline: <path d="M7 5v7a5 5 0 0010 0V5M5 19h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />,
  strike: <path d="M6 12h12M9 7.5c.7-1 1.8-1.5 3-1.5 2.3 0 4 1.2 4 3 0 3-8 1.5-8 5 0 1.5 1.5 3 4 3 1.7 0 3-.5 4-1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />,
  link: <path d="M10 14l4-4M8.5 15.5l-2 2a3 3 0 104.2 4.2l2-2M15.5 8.5l2-2A3 3 0 1021.7 11l-2 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  quote: <path d="M7 8h4v5H7zM13 8h4v5h-4zM9 13v3a2 2 0 01-2 2M15 13v3a2 2 0 01-2 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  bullet: <path d="M6 8h.01M6 12h.01M6 16h.01M10 8h8M10 12h8M10 16h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />,
  ordered: <path d="M5.5 8h1v2h-1M5 16h2l-2 2h2M10 8h8M10 12h8M10 16h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  task: <path d="M5 7h3v3H5zM5 14h3v3H5zM10 8h9M10 15h9M6 15.5l.8.8L8 14.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  table: <path d="M4 6h16v12H4zM4 11h16M9 6v12M15 6v12" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />,
  code: <path d="M9 8L5 12l4 4M15 8l4 4-4 4M13 6l-2 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  math: <path d="M5 7l5 10M10 7L5 17M14 9h5M16.5 6.5v5M14 16h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  diagram: <path d="M6 6h5v4H6zM13 14h5v4h-5zM6 14h5v4H6zM8.5 10v2M8.5 12h7M15.5 12v2" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />,
  image: <path d="M4 6h16v12H4zM7 10h.01M6 16l4-4 3 3 3-4 4 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  footnote: <path d="M7 7h6M10 7v10M15 14l2-2v6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  source: <path d="M8 8L4 12l4 4M16 8l4 4-4 4M13 5l-2 14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  appearance: (
    <>
      <path
        d="M12 4a8 8 0 100 16 2.5 2.5 0 000-5h-.7a1.8 1.8 0 01-1.8-1.8 1.9 1.9 0 011.9-1.9H14a3 3 0 003-3 3.3 3.3 0 00-3.4-3.3z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="8" cy="10" r="1" fill="currentColor" />
      <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="14" cy="7.5" r="1" fill="currentColor" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </>
  ),
  moon: (
    <path
      d="M14.5 3.5a8 8 0 108 8 6.3 6.3 0 01-8-8z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  autoTheme: (
    <>
      <path
        d="M12 3.2a8.8 8.8 0 100 17.6 6.9 6.9 0 010-17.6z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 1.8v2M12 20.2v2M2 12h2M20 12h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export default function Icon({ name, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      {iconPaths[name]}
    </svg>
  );
}
