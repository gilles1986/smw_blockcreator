import { describe, expect, it } from 'vitest';
import { HAND_EDIT_WARNING, type OpenedBlock } from './blockDocument';
import { openNotice } from './openNotice';

const opened = (extra: Partial<OpenedBlock> = {}): OpenedBlock => ({
  kind: 'opened',
  path: 'b.asm',
  model: { properties: { name: 'b', description: '', author: '', defaultActAs: 0x130 }, slots: {} },
  handEdited: false,
  missing: [],
  upgraded: [],
  ahead: [],
  ...extra,
});

describe('openNotice', () => {
  it('has nothing to say about a Block that opens as it is', () => {
    expect(openNotice(opened())).toBeNull();
  });

  it('warns about hand edits, as before', () => {
    expect(openNotice(opened({ handEdited: true }))).toEqual({
      kind: 'warning',
      text: HAND_EDIT_WARNING,
    });
  });

  it('names the missing Pieces, says they stay as placeholders and that saving is blocked', () => {
    const notice = openNotice(opened({ missing: ['time_machine', 'c_flux'] }))!;
    expect(notice.kind).toBe('warning');
    expect(notice.text).toBe(
      'Missing Pieces: time_machine, c_flux. They stay in the Block as grey blocks with their values; saving is blocked until you remove them, or add the Pieces and open the Block again.',
    );
  });

  it('tells which Pieces were older, from and to, and that saving writes the newer ones', () => {
    const notice = openNotice(
      opened({
        upgraded: [
          { id: 'a', name: 'Act as', from: 1, to: 2, dropped: [], reset: [] },
          { id: 'b', name: 'Boost Mario', from: 1, to: 3, dropped: [], reset: [] },
        ],
      }),
    )!;
    expect(notice.kind).toBe('info');
    expect(notice.text).toBe(
      'Pieces with a newer version than this Block was made with: Act as 1 → 2, Boost Mario 1 → 3. Saving writes the Block with the newer versions.',
    );
  });

  it('warns when an upgrade lost a value or reset one, and names the parameters', () => {
    const notice = openNotice(
      opened({
        upgraded: [
          {
            id: 'boost_mario',
            name: 'Boost Mario',
            from: 1,
            to: 2,
            dropped: ['change_x', 'x_speed'],
            reset: ['y_strength'],
          },
        ],
      }),
    )!;
    expect(notice.kind).toBe('warning');
    expect(notice.text).toContain(
      'Boost Mario 1 → 2 (values gone: change_x, x_speed; reset to the default: y_strength)',
    );
  });

  it('warns about Pieces that are newer in the Block than in this Library', () => {
    const notice = openNotice(
      opened({ ahead: [{ id: 'boost_mario', name: 'Boost Mario', recorded: 3, installed: 2 }] }),
    )!;
    expect(notice.kind).toBe('warning');
    expect(notice.text).toBe(
      'Made with newer Pieces than this Library has: Boost Mario (in the Block 3, here 2). Saving drops what this version does not know.',
    );
  });

  it('puts everything into one notice, one line each, the worst kind on top', () => {
    const notice = openNotice(
      opened({
        handEdited: true,
        missing: ['ghost'],
        upgraded: [{ id: 'a', name: 'Act as', from: 1, to: 2, dropped: [], reset: [] }],
        ahead: [{ id: 'b', name: 'Boost', recorded: 3, installed: 2 }],
      }),
    )!;
    expect(notice.kind).toBe('warning');
    expect(notice.text.split('\n')).toHaveLength(4);
    expect(notice.text.split('\n')[0]).toBe(HAND_EDIT_WARNING);
  });
});
