// Where Asar's errors show up in the editor (on Slot rows, on the Blockly blocks and in the
// error list they come from) and what a check means for saving. Pure data, tested without a DOM.

import type { CheckProblem } from '../core/assemble';
import type { Library } from '../core/library';
import { pieceAtPath, type BlockModel, type SlotId } from '../core/model';
import { blockIdsByPath, type WorkspaceState } from './blockly/workspace';

/** A message under the Slot list; `error` blocks nothing by itself, it only stands out. */
export interface Notice {
  kind: 'info' | 'warning' | 'error';
  text: string;
}

/** What an attempt to check the Block with Asar came to. */
export type CheckOutcome =
  | { kind: 'passed' }
  | { kind: 'errors'; problems: CheckProblem[] }
  /** No check ran: not the desktop app, or no usable GPS folder (`reason` says why, if known). */
  | { kind: 'unavailable'; reason?: string }
  /** A check was tried but Asar could not run. */
  | { kind: 'failed'; message: string };

/** What the Check button tells the user beyond the error list (which shows the errors). */
export function checkNotice(outcome: CheckOutcome): Notice | null {
  switch (outcome.kind) {
    case 'unavailable':
      return outcome.reason ? { kind: 'warning', text: outcome.reason } : null;
    case 'failed':
      return { kind: 'error', text: `Asar check failed: ${outcome.message}` };
    default:
      return null;
  }
}

/**
 * Spec: check before every save and let Asar's errors block it. A check that could not run does
 * not block (the Block is plain text; unchecked saves are how it works without a GPS folder), but
 * the note says what really happened.
 */
export function saveVerdict(outcome: CheckOutcome): { save: boolean; notice: Notice | null } {
  switch (outcome.kind) {
    case 'passed':
      return { save: true, notice: null };
    case 'errors':
      return { save: false, notice: null };
    case 'unavailable':
      return {
        save: true,
        notice: {
          kind: 'warning',
          text: `Saved without an Asar check: ${outcome.reason ?? 'no GPS folder chosen.'}`,
        },
      };
    case 'failed':
      return {
        save: true,
        notice: { kind: 'warning', text: `Saved, but the Asar check failed: ${outcome.message}` },
      };
  }
}

/** Slots that at least one error points into. */
export function slotsWithProblems(problems: readonly CheckProblem[]): Set<SlotId> {
  return new Set(problems.flatMap((problem) => (problem.origin ? [problem.origin.slot] : [])));
}

/** Name of the Piece an error comes from, when it comes from one. */
export function problemPieceName(
  problem: CheckProblem,
  slots: BlockModel['slots'],
  library: Library,
): string | undefined {
  if (!problem.origin) return undefined;
  const ref = pieceAtPath(slots[problem.origin.slot] ?? [], problem.origin.path);
  return ref && library.pieces.get(ref.id)?.manifest.name;
}

/** Blockly block id → warning text, for the errors of one Slot. */
export function blockWarnings(
  problems: readonly CheckProblem[],
  slot: SlotId,
  workspace: WorkspaceState,
  library: Library,
): Map<string, string> {
  const ids = blockIdsByPath(workspace, library);
  const warnings = new Map<string, string>();
  for (const { origin, message } of problems) {
    const id = origin?.slot === slot ? ids.get(origin.path) : undefined;
    if (id === undefined) continue;
    const earlier = warnings.get(id);
    warnings.set(id, earlier ? `${earlier}\n${message}` : message);
  }
  return warnings;
}
