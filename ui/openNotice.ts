// What the user is told after a Block was opened: hand edits, Pieces the Library does not have,
// Pieces whose version changed. Pure text, tested without a DOM.

import type { PieceUpgrade } from '../core/model';
import { HAND_EDIT_WARNING, type OpenedBlock } from './blockDocument';
import type { Notice } from './checkView';

/** One notice for everything worth saying about an opened Block; null when there is nothing. */
export function openNotice(opened: OpenedBlock): Notice | null {
  const lines: { kind: Notice['kind']; text: string }[] = [];
  if (opened.handEdited) lines.push({ kind: 'warning', text: HAND_EDIT_WARNING });
  if (opened.missing.length > 0) {
    lines.push({
      kind: 'warning',
      text: `Missing Pieces: ${opened.missing.join(', ')}. They stay in the Block as grey blocks with their values; saving is blocked until you remove them, or add the Pieces and open the Block again.`,
    });
  }
  if (opened.upgraded.length > 0) {
    const lossy = opened.upgraded.some((piece) => piece.dropped.length + piece.reset.length > 0);
    lines.push({
      kind: lossy ? 'warning' : 'info',
      text: `Pieces with a newer version than this Block was made with: ${opened.upgraded.map(upgradeText).join(', ')}. Saving writes the Block with the newer versions.`,
    });
  }
  if (opened.ahead.length > 0) {
    const pieces = opened.ahead.map(
      (piece) => `${piece.name} (in the Block ${piece.recorded}, here ${piece.installed})`,
    );
    lines.push({
      kind: 'warning',
      text: `Made with newer Pieces than this Library has: ${pieces.join(', ')}. Saving drops what this version does not know.`,
    });
  }
  if (lines.length === 0) return null;
  return {
    kind: lines.some((line) => line.kind === 'warning') ? 'warning' : 'info',
    text: lines.map((line) => line.text).join('\n'),
  };
}

/** `Boost Mario 1 → 2`, with what became of the values in brackets when something did. */
function upgradeText({ name, from, to, dropped, reset }: PieceUpgrade): string {
  const changes = [
    ...(dropped.length > 0 ? [`values gone: ${dropped.join(', ')}`] : []),
    ...(reset.length > 0 ? [`reset to the default: ${reset.join(', ')}`] : []),
  ];
  return `${name} ${from} → ${to}${changes.length > 0 ? ` (${changes.join('; ')})` : ''}`;
}
