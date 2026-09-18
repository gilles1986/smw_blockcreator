// The Block model: what the tool edits and what the `;@bc-model` header stores (ADR 1).
// It holds Piece ids, versions and parameter values — never Piece code.

import type { Value } from '../template';

/** Version of the header format and the model JSON inside it; bump it with a migration. */
export const MODEL_FORMAT = 1;

/** Slots are Block sides (CONTEXT.md), not GPS offsets; the generator maps them onto offsets. */
export const SLOT_IDS = [
  'marioTop',
  'marioBottom',
  'marioLeft',
  'marioRight',
  'marioInside',
  'marioTopCorner',
  'marioHeadInside',
  'marioBodyInside',
  'marioCape',
  'marioFireball',
  'marioWallFeet',
  'marioWallBody',
  'spriteTop',
  'spriteBottom',
  'spriteLeft',
  'spriteRight',
] as const;
export type SlotId = (typeof SLOT_IDS)[number];

/** Who touches the Block in a Slot; Pieces declare which of these they work for. */
export type SlotKind = 'mario' | 'sprite';

export function slotKind(slot: SlotId): SlotKind {
  return slot.startsWith('sprite') ? 'sprite' : 'mario';
}

export const SLOT_KIND_NAMES: Record<SlotKind, string> = { mario: 'Mario', sprite: 'Sprite' };

/** Whether a Piece made for `slots` (its manifest field) may be used in a Slot of `kind`. */
export function fitsSlot(slots: SlotKind | 'any', kind: SlotKind): boolean {
  return slots === 'any' || slots === kind;
}

export interface BlockProperties {
  /** Also the file name. */
  name: string;
  description: string;
  author: string;
  /** Map16 number the Block should be inserted with (`list.txt`); not emitted as code. */
  defaultActAs: number;
}

/** One use of a Piece: which Piece, which version it was made with, and its parameter values. */
export interface PieceRef {
  id: string;
  version: number;
  params: Record<string, Value>;
}

/** Ticket 08 adds `and` / `or` / `not`. */
export type ConditionExpr = { type: 'condition'; piece: PieceRef };

export interface Branch {
  condition: ConditionExpr;
  body: Statement[];
}

export type Statement =
  | { type: 'action'; piece: PieceRef }
  /** `if` / `else if` … / `else`: the first branch whose condition holds runs. */
  | { type: 'if'; branches: Branch[]; else?: Statement[] };

export interface BlockModel {
  properties: BlockProperties;
  /** Empty or missing Slots generate a bare `RTL`. */
  slots: Partial<Record<SlotId, Statement[]>>;
  /**
   * While the Top corner Slot is empty, it does what Top does (default `true`, also when
   * absent). `false` leaves the corner doing nothing. A filled Top corner Slot always wins.
   */
  topCornerFollowsTop?: boolean;
}

/** Whether a Slot has any statements. */
export function slotFilled(model: BlockModel, slot: SlotId): boolean {
  return (model.slots[slot]?.length ?? 0) > 0;
}

/** True while the Top corner Slot is empty and does what Top does (the default link). */
export function cornerFollowsTop(model: BlockModel): boolean {
  return model.topCornerFollowsTop !== false && !slotFilled(model, 'marioTopCorner');
}

export { checkPieces } from './check';
