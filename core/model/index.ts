// The Block model: what the tool edits and what the `;@bc-model` header stores (ADR 1).
// It holds Piece ids, versions and parameter values — never Piece code.

import type { Value } from '../template';

/** Version of the header format and the model JSON inside it; bump it with a migration. */
export const MODEL_FORMAT = 1;

/** Slots the generator knows so far (ticket 07 adds sides, sprites and advanced Slots). */
export const SLOT_IDS = ['marioTop', 'marioBottom', 'marioInside'] as const;
export type SlotId = (typeof SLOT_IDS)[number];

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
}
