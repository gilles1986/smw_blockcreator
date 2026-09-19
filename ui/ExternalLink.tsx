import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';

/**
 * A link that opens in the system browser. In the desktop app a plain link would load the page
 * into the app's own window, so it is opened through the shell instead.
 */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!isTauri()) return;
        event.preventDefault();
        void openUrl(href);
      }}
    >
      {children}
    </a>
  );
}
