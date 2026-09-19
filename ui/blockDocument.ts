// Open / Save / Save as for a Block file. File dialogs and disk access come in through
// `FileAccess` (Tauri in the app, a fake in tests), so the rules live here and are testable.

import { parse } from '../core/header';
import type { Library } from '../core/library';
import { checkPieces, type BlockModel } from '../core/model';

export interface FileAccess {
  /** Native "Open" dialog; null when cancelled. */
  chooseOpenPath(): Promise<string | null>;
  /** Native "Save as" dialog; null when cancelled. */
  chooseSavePath(suggestedName: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  /** A yes/no question; true means go ahead. */
  confirm(message: string): Promise<boolean>;
}

export const DISCARD_QUESTION = 'Discard unsaved changes to the current Block?';

export const HAND_EDIT_WARNING = 'This file was edited by hand; saving will overwrite those edits.';

export type OpenOutcome =
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string }
  | { kind: 'opened'; path: string; model: BlockModel; handEdited: boolean };

export async function openBlock(
  files: FileAccess,
  { library, unsavedChanges = false }: { library: Library; unsavedChanges?: boolean },
): Promise<OpenOutcome> {
  if (unsavedChanges && !(await files.confirm(DISCARD_QUESTION))) return { kind: 'cancelled' };
  const path = await files.chooseOpenPath();
  if (path === null) return { kind: 'cancelled' };
  let text: string;
  try {
    text = await files.read(path);
  } catch (error) {
    return { kind: 'failed', message: `Could not read ${path}: ${errorText(error)}` };
  }
  const result = parse(text);
  if (!result.ok) return { kind: 'failed', message: result.message };
  // Until missing Pieces get placeholders (ticket 16), a Block this Library cannot edit is refused.
  const problems = checkPieces(result.model, library);
  if (problems.length > 0) {
    return { kind: 'failed', message: `${path} cannot be opened:\n${bulletList(problems)}` };
  }
  return { kind: 'opened', path, model: result.model, handEdited: !result.checksumOk };
}

export interface BlockDocument {
  /** Where the Block was last opened from or saved to. */
  path: string | undefined;
  /** Block name, suggested as the file name. */
  name: string;
  /** Generated file text. */
  text: string;
  /** Logic that saving would lose (see `workspaceProblems`); saving is refused while any exist. */
  problems: readonly string[];
}

export type SaveOutcome =
  | { kind: 'cancelled' }
  | { kind: 'blocked'; message: string }
  | { kind: 'failed'; message: string }
  | { kind: 'saved'; path: string };

export async function saveBlock(
  files: FileAccess,
  doc: BlockDocument,
  { saveAs = false }: { saveAs?: boolean } = {},
): Promise<SaveOutcome> {
  if (doc.problems.length > 0) {
    return { kind: 'blocked', message: `Fix this before saving:\n${bulletList(doc.problems)}` };
  }
  const path =
    saveAs || doc.path === undefined
      ? await files.chooseSavePath(`${fileName(doc.name)}.asm`)
      : doc.path;
  if (path === null) return { kind: 'cancelled' };
  try {
    if (!(await mayOverwrite(files, path))) return { kind: 'cancelled' };
    await files.write(path, doc.text);
  } catch (error) {
    return { kind: 'failed', message: `Could not save ${path}: ${errorText(error)}` };
  }
  return { kind: 'saved', path };
}

/**
 * What to ask before the file `existing` (the text on disk at `path`) is replaced: it holds hand
 * edits, is newer, or is not a BlockCreator Block. Null when it can be replaced without asking.
 */
export function overwriteQuestion(existing: string, path: string): string | null {
  const found = parse(existing);
  if (found.ok) return found.checksumOk ? null : `${HAND_EDIT_WARNING} Save anyway?`;
  if (found.reason === 'newer-format') {
    return `${path} was made with a newer BlockCreator. Replace it with this older format?`;
  }
  return `${path} was not made by BlockCreator. Replace it?`;
}

async function mayOverwrite(files: FileAccess, path: string): Promise<boolean> {
  if (!(await files.exists(path))) return true;
  const question = overwriteQuestion(await files.read(path), path);
  return question === null || files.confirm(question);
}

/** The Block name as a file name: characters Windows forbids become `_`. */
export function fileName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, '_') || 'block';
}

function bulletList(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join('\n');
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
