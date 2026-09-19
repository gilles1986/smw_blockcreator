// Ticket 17: the one-line summary of a Slot's logic, for the Slot rows: what the prototype's
// overview showed ("act as 130 · if ON/OFF is ON: …"), written from the Pieces' manifests.
import { describe, expect, it } from 'vitest';
import type { ConditionExpr, PieceRef, Statement } from '../model';
import { BUILT_IN_NAMES } from '../names';
import { builtInLibrary } from '../testing/library';
import { PRESETS } from '../testing/presets';
import { summarizeCondition, summarizePiece, summarizeStatements } from './index';

const library = builtInLibrary();
const ref = (id: string, params: PieceRef['params'] = {}): PieceRef => ({ id, version: 1, params });
const action = (id: string, params?: PieceRef['params']): Statement => ({
  type: 'action',
  piece: ref(id, params),
});
const cond = (id: string, params?: PieceRef['params']): ConditionExpr => ({
  type: 'condition',
  piece: ref(id, params),
});

describe('summarizePiece', () => {
  it('is the name and the value, for a Piece with one or two parameters', () => {
    expect(summarizePiece(ref('act_as', { tile: 0x130 }), library)).toBe('Act as 130');
    expect(summarizePiece(ref('act_as', { tile: 0x25 }), library)).toBe('Act as 025');
    expect(summarizePiece(ref('give_coins', { amount: 5 }), library)).toBe('Give coins 5');
    expect(summarizePiece(ref('change_to_tile', { tile: 0x132 }), library)).toBe(
      'Change to tile 132',
    );
    expect(summarizePiece(ref('c_onoff', { position: 0 }), library)).toBe('ON/OFF switch is ON');
    expect(summarizePiece(ref('c_onoff', { position: 1 }), library)).toBe('ON/OFF switch is OFF');
    expect(summarizePiece(ref('c_button', { button: 'up', mode: 'pressed' }), library)).toBe(
      'Controller button Up, Pressed (this frame)',
    );
    expect(summarizePiece(ref('write_ram', { address: 0x85, value: 1 }), library)).toBe(
      'Write RAM $85, $01',
    );
  });

  it('is just the name when there is nothing to say', () => {
    expect(summarizePiece(ref('c_really_on_top'), library)).toBe('Mario is really on top');
    // A switch that is off says nothing; a Piece that lacks values has its defaults.
    expect(summarizePiece(ref('hurt_mario', { side_hitbox: false }), library)).toBe('Hurt Mario');
    expect(summarizePiece(ref('hurt_mario'), library)).toBe('Hurt Mario');
  });

  it('names a switch that is on', () => {
    expect(summarizePiece(ref('hurt_mario', { side_hitbox: true }), library)).toBe(
      'Hurt Mario muncher hitbox',
    );
  });

  it('with more parameters, says only what is not the default, with the labels', () => {
    const boost = { x_direction: 'away', y_direction: 'away' };
    expect(summarizePiece(ref('boost_mario', boost), library)).toBe(
      'Boost Mario (horizontal push Away from the block, vertical push Away from the block)',
    );
    expect(
      summarizePiece(ref('boost_mario', { x_direction: 'left', x_strength: 16 }), library),
    ).toBe('Boost Mario (horizontal push Left, X strength 16)');
    // The defaults: nothing changed.
    expect(summarizePiece(ref('boost_mario'), library)).toBe('Boost Mario');
  });

  it('leaves out a parameter the block does not show, and names a sprite as the list does', () => {
    const shell = 0xda;
    const spawn = ref('spawn_sprite', {
      custom: false,
      sprite_number: shell,
      position: 'above',
      state: 10,
      extra_byte_1: 7,
      x_offset: 5,
      x_speed: 32,
      y_speed: -48,
      facing: 'right',
    });
    const name = BUILT_IN_NAMES.sprites(false).find((sprite) => sprite.id === shell)!.name;
    expect(summarizePiece(spawn, library)).toBe(
      `Spawn sprite (sprite number ${name}, spawn position Above block, initial state Kicked ($0A), X speed 32, Y speed -48, facing Right)`,
    );
  });

  it('uses the number when a sprite has no name, and the names it is given', () => {
    const spawn = ref('spawn_sprite', { custom: true, sprite_number: 0x30 });
    expect(summarizePiece(spawn, library)).toBe(
      'Spawn sprite (custom (PIXI) sprite, sprite number $30)',
    );
    const pixi = { ...BUILT_IN_NAMES, sprites: () => [{ id: 0x30, name: 'Flame' }] };
    expect(summarizePiece(spawn, library, pixi)).toContain('sprite number Flame');
  });

  it('shows the first line of a text, cut short', () => {
    const custom = ref('custom_asm', { code: 'LDA #$01\nSTA $19' });
    expect(summarizePiece(custom, library)).toBe('Custom ASM LDA #$01…');
    const long = ref('custom_asm', { code: '; ' + 'x'.repeat(80) });
    expect(summarizePiece(long, library).length).toBeLessThan(50);
  });

  it('marks a Piece the Library does not have', () => {
    expect(summarizePiece(ref('time_machine', { year: 1985 }), library)).toBe('? time_machine');
  });
});

describe('summarizeStatements', () => {
  it('is empty for nothing', () => {
    expect(summarizeStatements([], library)).toBe('');
  });

  it('joins the Actions with a dot, in order', () => {
    expect(
      summarizeStatements(
        [action('give_coins', { amount: 1 }), action('change_to_tile', { tile: 0x132 })],
        library,
      ),
    ).toBe('Give coins 1 · Change to tile 132');
  });

  it('writes an if as if / else if / else, with a dash for an empty part', () => {
    const rule: Statement = {
      type: 'if',
      branches: [
        { condition: cond('c_onoff', { position: 0 }), body: [action('act_as', { tile: 0x130 })] },
        { condition: cond('c_star'), body: [] },
      ],
      else: [action('act_as', { tile: 0x25 })],
    };
    expect(summarizeStatements([rule], library)).toBe(
      'if ON/OFF switch is ON: Act as 130 else if Mario has Star power: — else: Act as 025',
    );
  });

  it('writes AND, OR and NOT the way it reads, and nests', () => {
    const rule: Statement = {
      type: 'if',
      branches: [
        {
          condition: {
            type: 'and',
            left: cond('c_ducking'),
            right: { type: 'not', condition: cond('c_yoshi') },
          },
          body: [
            {
              type: 'if',
              branches: [
                {
                  condition: { type: 'or', left: cond('c_star'), right: cond('c_flying') },
                  body: [action('kill_mario')],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(summarizeStatements([rule], library)).toBe(
      'if (Mario is ducking and not Mario is riding Yoshi): if (Mario has Star power or Mario is flying): Kill Mario',
    );
  });

  it('summarizeCondition is what stands between if and the colon', () => {
    expect(summarizeCondition(cond('c_onoff', { position: 1 }), library)).toBe(
      'ON/OFF switch is OFF',
    );
  });
});

describe('the Presets', () => {
  const summary = (name: string, slot: keyof (typeof PRESETS)[string]['slots']) =>
    summarizeStatements(PRESETS[name]!.slots[slot] ?? [], library);

  it('read the way the prototype read for its example Blocks', () => {
    expect(summary('onoff_solid', 'marioTop')).toBe(
      'if ON/OFF switch is ON: Act as 130 else: Act as 025',
    );
    expect(summary('mario_passable', 'marioTop')).toBe('Act as 025');
    expect(summary('muncher', 'marioTop')).toBe('Hurt Mario');
    expect(summary('muncher', 'marioLeft')).toBe('Hurt Mario muncher hitbox');
    expect(summary('death_block', 'marioLeft')).toBe('Kill Mario muncher hitbox');
    expect(summary('one_way', 'marioTop')).toBe(
      'if Mario is really on top: Act as 130 else: Act as 025',
    );
    expect(summary('coin_once', 'marioBottom')).toBe('Give coins 1 · Change to tile 132');
    expect(summary('muncher_sprite_killer', 'spriteTop')).toBe(
      'Kill touching sprite Spin-kill puff & stars',
    );
    expect(summary('water_toggle', 'marioTop')).toBe(
      'if Controller button Up, Pressed (this frame): if RAM check (RAM Address $85): Write RAM $85, $01 else: Write RAM $85, $00',
    );
  });

  it('never leave a Slot without a summary that has logic', () => {
    for (const [name, model] of Object.entries(PRESETS)) {
      for (const [slot, statements] of Object.entries(model.slots)) {
        expect(summarizeStatements(statements ?? [], library), `${name} ${slot}`).not.toBe('');
      }
    }
  });
});
