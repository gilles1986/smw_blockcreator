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

/** A tool routine the Block calls, as BlockCreator ships it (`routines/<name>.asm` in GPS). */
export interface RoutineFile {
  /** `bc_…`, also the file name without `.asm`. */
  name: string;
  text: string;
}

export interface ProjectDocument {
  /** Block name, also the file name. */
  name: string;
  /** Generated file text. */
  text: string;
  /** Logic that saving would lose; saving is refused while any exist. */
  problems: readonly string[];
  /** The tool routines the Block calls; the project needs them for GPS to assemble it. */
  routines?: readonly RoutineFile[];
}

/** What became of the tool routines a Block needs. */
export interface RoutineReport {
  /** Copied into the project, new or replacing a different one. */
  copied: string[];
  /** Needed, not in the project, and not copied because the user said no. */
  missing: string[];
  /** In the project with other content, which the user chose to keep. */
  kept: string[];
}

export type ProjectSaveOutcome =
  | { kind: 'cancelled' }
  | { kind: 'blocked'; message: string }
  | { kind: 'failed'; message: string }
  /** `path` is relative to the GPS folder; `listUpdated` is false when the list already said so. */
  | { kind: 'saved'; path: string; listUpdated: boolean; routines: RoutineReport };

/** The Block's file below `blocks/`, as `list.txt` names it. */
export function listFile(name: string): string {
  return `${BLOCK_FOLDER}/${fileName(name)}.asm`;
}

/** Text compared without regard to the kind of line break. */
const sameText = (a: string, b: string) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

/**
 * Puts the routines a Block needs into the project's `routines/` folder. Nothing is asked when
 * they are all there and the same: a missing one is copied after one question, a different one
 * only after a question of its own, and neither is ever replaced silently.
 */
async function copyRoutines(
  project: ProjectFiles,
  routines: readonly RoutineFile[],
): Promise<RoutineReport> {
  const report: RoutineReport = { copied: [], missing: [], kept: [] };
  const missing: RoutineFile[] = [];
  const different: RoutineFile[] = [];
  for (const routine of routines) {
    const existing = await project.read(`routines/${routine.name}.asm`);
    if (existing === null) missing.push(routine);
    else if (!sameText(existing, routine.text)) different.push(routine);
  }
  if (missing.length > 0) {
    const names = missing.map((routine) => `${routine.name}.asm`).join(', ');
    const question = `This Block needs ${names}, which the GPS project does not have. Copy it into the project's routines folder?`;
    if (await project.confirm(question)) {
      for (const routine of missing) {
        await project.write(`routines/${routine.name}.asm`, routine.text);
        report.copied.push(routine.name);
      }
    } else {
      report.missing.push(...missing.map((routine) => routine.name));
    }
  }
  for (const routine of different) {
    const question = `routines/${routine.name}.asm in the GPS project is not the one that comes with BlockCreator. Replace it?`;
    if (await project.confirm(question)) {
      await project.write(`routines/${routine.name}.asm`, routine.text);
      report.copied.push(routine.name);
    } else {
      report.kept.push(routine.name);
    }
  }
  return report;
}

/**
 * Writes the Block file, then (with a `list` choice) updates `list.txt` after saving the old one
 * as `list.txt.bak`, and copies the tool routines the Block needs. The list is worked out first,
 * so a tile another file holds stops the save before anything is written.
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
    const routines = await copyRoutines(project, doc.routines ?? []);
    return { kind: 'saved', path, listUpdated, routines };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      kind: 'failed',
      message: error instanceof ListError ? message : `Could not save to the project: ${message}`,
    };
  }
}
