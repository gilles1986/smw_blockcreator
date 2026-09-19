// Save to project: the Block goes into the GPS project's `blocks/blockcreator/` and, when asked,
// gets a line in its `list.txt` (with a `list.txt.bak` of the old list). Disk access comes in
// through `ProjectFiles` (Tauri commands in the app, a fake in tests), so the rules are testable.

import { ListError, withBlockEntry } from '../core/listtxt';
import { fileName, overwriteQuestion } from './blockDocument';

/** Folder below the GPS project's `blocks/` that BlockCreator's Blocks go into. */
export const BLOCK_FOLDER = 'blockcreator';

export interface ProjectFiles {
  /** A file's text, path relative to the GPS folder; null when there is no such file. */
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
  /** A yes/no question; true means go ahead. */
  confirm(message: string): Promise<boolean>;
}

/** Where the Block goes into `list.txt`. */
export interface ListChoice {
  tile: number;
  actAs: number;
}

export interface ProjectDocument {
  /** Block name, also the file name. */
  name: string;
  /** Generated file text. */
  text: string;
  /** Logic that saving would lose; saving is refused while any exist. */
  problems: readonly string[];
}

export type ProjectSaveOutcome =
  | { kind: 'cancelled' }
  | { kind: 'blocked'; message: string }
  | { kind: 'failed'; message: string }
  /** `path` is relative to the GPS folder; `listUpdated` is false when the list already said so. */
  | { kind: 'saved'; path: string; listUpdated: boolean };

/** The Block's file below `blocks/`, as `list.txt` names it. */
export function listFile(name: string): string {
  return `${BLOCK_FOLDER}/${fileName(name)}.asm`;
}

/**
 * Writes the Block file, then (with a `list` choice) updates `list.txt` after saving the old one
 * as `list.txt.bak`. The list is worked out first, so a tile another file holds stops the save
 * before anything is written.
 */
export async function saveToProject(
  project: ProjectFiles,
  doc: ProjectDocument,
  list?: ListChoice,
): Promise<ProjectSaveOutcome> {
  if (doc.problems.length > 0) {
    const lines = doc.problems.map((line) => `- ${line}`).join('\n');
    return { kind: 'blocked', message: `Fix this before saving:\n${lines}` };
  }
  const path = `blocks/${listFile(doc.name)}`;
  try {
    let oldList: string | null = null;
    let newList: string | undefined;
    if (list) {
      oldList = await project.read('list.txt');
      if (oldList === null) return { kind: 'failed', message: 'The GPS folder has no list.txt.' };
      newList = withBlockEntry(oldList, { ...list, file: listFile(doc.name) });
    }
    const existing = await project.read(path);
    if (existing !== null) {
      const question = overwriteQuestion(existing, path);
      if (question !== null && !(await project.confirm(question))) return { kind: 'cancelled' };
    }
    await project.write(path, doc.text);
    const listUpdated = newList !== undefined && oldList !== null && newList !== oldList;
    if (listUpdated) {
      await project.write('list.txt.bak', oldList!);
      await project.write('list.txt', newList!);
    }
    return { kind: 'saved', path, listUpdated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      kind: 'failed',
      message: error instanceof ListError ? message : `Could not save to the project: ${message}`,
    };
  }
}
