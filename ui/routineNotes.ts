// What the user is told about the tool routines (`bc_*`) a Block needs: after "Save to GPS
// project…" (what was copied, what is still missing) and after a plain Save / Save as…, which
// write the file somewhere and cannot copy them.

import type { Notice } from './checkView';
import type { ListChoice, ProjectSaveOutcome } from './projectSave';
import { formatHex } from './hex';

const files = (names: readonly string[]) => names.map((name) => `${name}.asm`).join(', ');

/** The notice after a Block was saved into the GPS project. */
export function savedToProjectNotice(
  outcome: Extract<ProjectSaveOutcome, { kind: 'saved' }>,
  list?: ListChoice,
): Notice {
  const { copied, missing, kept } = outcome.routines;
  const added =
    outcome.listUpdated && list
      ? ` and put it in list.txt at ${formatHex(list.tile, 4)} (the old list is list.txt.bak)`
      : '';
  const text = [`Saved ${outcome.path}${added}.`];
  if (copied.length > 0) text.push(`Copied ${files(copied)} into the routines folder.`);
  if (missing.length > 0) {
    text.push(
      `${files(missing)} is not in the project's routines folder: GPS cannot assemble the Block until it is.`,
    );
  }
  if (kept.length > 0) {
    text.push(
      `Kept the project's own ${files(kept)}, which is not the one that comes with BlockCreator.`,
    );
  }
  text.push("Run GPS (or Callisto's Update) to insert it.");
  return { kind: missing.length > 0 || kept.length > 0 ? 'warning' : 'info', text: text.join(' ') };
}

/**
 * What to tell after a Save or Save as…, which cannot copy the routines: which files the Block
 * needs and where they go. Undefined when it needs none.
 */
export function routineFilesNote(
  routines: readonly string[],
  gpsFolder?: string,
): string | undefined {
  if (routines.length === 0) return undefined;
  const where = gpsFolder ? `${gpsFolder}/routines` : 'the routines folder of your GPS project';
  return `This Block needs ${files(routines)} in ${where}. "Save to GPS project…" copies them there.`;
}
