import type { ReactNode } from 'react';

// Small line icons for the buttons of the sidebar, drawn on a 24×24 grid and coloured by the
// button's text colour (see `.icon` in app.css).

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const FLOPPY =
  'M5 3h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v5h8V3M7 21v-6h10v6';

export function NewIcon() {
  return (
    <Icon>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14h6" />
    </Icon>
  );
}

/** Two pages, one behind the other: a Block to start from. */
export function PresetIcon() {
  return (
    <Icon>
      <path d="M8 3h9a2 2 0 0 1 2 2v11M5 7h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM7 12h5M7 16h5" />
    </Icon>
  );
}

export function OpenIcon() {
  return (
    <Icon>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

export function SaveIcon() {
  return (
    <Icon>
      <path d={FLOPPY} />
    </Icon>
  );
}

/** The floppy with a plus in a corner: a new file is made. */
export function SaveAsIcon() {
  return (
    <Icon>
      <path d={FLOPPY} />
      <circle className="badge" cx="18" cy="18" r="5.5" />
      <path d="M18 15.5v5M15.5 18h5" />
    </Icon>
  );
}

/** The folder with an arrow going in: the Block is put into the GPS project. */
export function ProjectIcon() {
  return (
    <Icon>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6M9.5 13.5L12 16l2.5-2.5" />
    </Icon>
  );
}

/** Three sliders. */
export function SettingsIcon() {
  return (
    <Icon>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle className="badge" cx="9" cy="6" r="2.2" />
      <circle className="badge" cx="15" cy="12" r="2.2" />
      <circle className="badge" cx="8" cy="18" r="2.2" />
      <circle cx="9" cy="6" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="8" cy="18" r="2.2" />
    </Icon>
  );
}

export function InfoIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Icon>
  );
}
