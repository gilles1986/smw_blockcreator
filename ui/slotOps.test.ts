import { describe, expect, it } from 'vitest';
import type { WorkspaceState } from './blockly/workspace';
import { copySlot, type SlotState } from './slotOps';

const stack = (id: string, tile: string): WorkspaceState => ({
  blocks: {
    languageVersion: 0,
    blocks: [{ type: 'piece_act_as', id, x: 20, y: 20, fields: { tile } }],
  },
});

describe('copySlot', () => {
  it('puts a copy of one Slot’s logic into another Slot of the same kind', () => {
    const state: SlotState = { workspaces: { marioTop: stack('a', '130') }, slotLinks: {} };
    const next = copySlot(state, 'marioTop', 'marioBottom');
    expect(next.workspaces.marioBottom).toEqual(state.workspaces.marioTop);
    expect(next.workspaces.marioTop).toEqual(state.workspaces.marioTop);
  });

  it('copies, it does not share: changing one leaves the other alone', () => {
    const state: SlotState = { workspaces: { marioTop: stack('a', '130') }, slotLinks: {} };
    const next = copySlot(state, 'marioTop', 'marioBottom');
    expect(next.workspaces.marioBottom).not.toBe(next.workspaces.marioTop);
    next.workspaces.marioBottom!.blocks!.blocks[0]!.fields = { tile: '025' };
    expect(next.workspaces.marioTop!.blocks!.blocks[0]!.fields).toEqual({ tile: '130' });
  });

  it('does not change the state it was given', () => {
    const state: SlotState = {
      workspaces: { marioTop: stack('a', '130'), marioBottom: stack('b', '025') },
      slotLinks: { marioLeft: 'marioTop' },
    };
    const before = JSON.stringify(state);
    copySlot(state, 'marioTop', 'marioBottom');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('replaces what the target had', () => {
    const state: SlotState = {
      workspaces: { marioTop: stack('a', '130'), marioBottom: stack('b', '025') },
      slotLinks: {},
    };
    expect(copySlot(state, 'marioTop', 'marioBottom').workspaces.marioBottom).toEqual(
      stack('a', '130'),
    );
  });

  it('copies the logic a linked Slot uses, whichever Slot holds it', () => {
    const state: SlotState = {
      workspaces: { marioLeft: stack('l', '12F') },
      slotLinks: { marioRight: 'marioLeft' },
    };
    expect(copySlot(state, 'marioRight', 'marioTop').workspaces.marioTop).toEqual(
      stack('l', '12F'),
    );
  });

  it('makes a linked target its own again; Slots that follow the target keep following it', () => {
    const state: SlotState = {
      workspaces: { marioTop: stack('a', '130'), marioLeft: stack('l', '12F') },
      slotLinks: { marioBottom: 'marioLeft', marioRight: 'marioBottom' },
    };
    const next = copySlot(state, 'marioTop', 'marioBottom');
    expect(next.slotLinks).toEqual({ marioRight: 'marioBottom' });
    expect(next.workspaces.marioBottom).toEqual(stack('a', '130'));
  });

  it('leaves everything as it is for another kind of Slot, the same Slot, or the same logic', () => {
    const state: SlotState = {
      workspaces: { marioLeft: stack('l', '12F'), spriteTop: stack('s', '130') },
      slotLinks: { marioRight: 'marioLeft' },
    };
    expect(copySlot(state, 'marioLeft', 'spriteLeft')).toBe(state);
    expect(copySlot(state, 'marioLeft', 'marioLeft')).toBe(state);
    // marioRight already is marioLeft's logic.
    expect(copySlot(state, 'marioLeft', 'marioRight')).toBe(state);
    expect(copySlot(state, 'marioRight', 'marioLeft')).toBe(state);
  });

  it('empties the target when the source has no logic', () => {
    const state: SlotState = { workspaces: { marioBottom: stack('b', '025') }, slotLinks: {} };
    expect(copySlot(state, 'marioTop', 'marioBottom').workspaces.marioBottom).toEqual({});
  });
});
