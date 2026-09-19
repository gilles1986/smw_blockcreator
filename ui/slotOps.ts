// Operations on the Slots of a Block being edited that are more than one Slot's own business.
// Pure data (Blockly workspaces as JSON), so the rules are tested without a DOM.

import { slotKind, type SlotId } from '../core/model';
import type { WorkspaceState } from './blockly/workspace';

/** What the editor holds per Slot: its logic, and which Slots use another Slot's logic. */
export interface SlotState {
  workspaces: Partial<Record<SlotId, WorkspaceState>>;
  slotLinks: Partial<Record<SlotId, SlotId>>;
}

/** The Slot whose logic `slot` uses: itself, or the end of its chain of links. */
function follow(links: SlotState['slotLinks'], slot: SlotId): SlotId {
  const seen = new Set<SlotId>();
  let current = slot;
  while (links[current] && !seen.has(current)) {
    seen.add(current);
    current = links[current]!;
  }
  return current;
}

/**
 * A copy of `from`'s logic (what it uses, when it is linked) in `to`, which becomes a Slot of its own
 * again if it was linked; Slots that use `to` go on using it. Only Slots of one kind can share
 * logic (a Mario Piece does not work for a sprite), and copying a Slot onto itself, or onto a
 * Slot that already uses the same logic, changes nothing: the state comes back as it was.
 */
export function copySlot(state: SlotState, from: SlotId, to: SlotId): SlotState {
  if (from === to || slotKind(from) !== slotKind(to)) return state;
  const source = follow(state.slotLinks, from);
  if (source === follow(state.slotLinks, to)) return state;
  const slotLinks = { ...state.slotLinks };
  delete slotLinks[to];
  const logic = state.workspaces[source];
  return {
    workspaces: { ...state.workspaces, [to]: logic ? structuredClone(logic) : {} },
    slotLinks,
  };
}
