import { describe, expect, it } from 'vitest';
import type { BlockModel, Statement } from '../model';
import { summarizeStatements } from '../summary';
import { builtInLibrary } from '../testing/library';
import { generate } from './index';
import { statementsToWorkspace, workspaceToStatements } from '../../ui/blockly/workspace';

const library = builtInLibrary();

describe('atNeighbour statement', () => {
  const baseModel: BlockModel = {
    properties: {
      name: 'test_neighbour',
      description: 'Tests neighbour container block',
      author: 'BlockCreator',
      defaultActAs: 0x130,
    },
    slots: {},
  };

  it('generates code for smoke puff and erasing neighbour block above', () => {
    const model: BlockModel = {
      ...baseModel,
      slots: {
        marioBottom: [
          {
            type: 'atNeighbour',
            direction: 'above',
            distance: 16,
            body: [
              { type: 'action', piece: { id: 'create_smoke', version: 1, params: {} } },
              { type: 'action', piece: { id: 'erase_block', version: 1, params: {} } },
            ],
          },
        ],
      },
    };

    const asm = generate(model, library).text;

    // Checks stack save of $98 and $9A
    expect(asm).toContain('REP #$20');
    expect(asm).toContain('LDA $98\n\tPHA\n\tLDA $9A\n\tPHA');
    // Moves 16 px ($0010) above
    expect(asm).toContain('LDA $98\n\tSEC\n\tSBC #$0010\n\tSTA $98');
    // SEP #$20 before body
    expect(asm).toContain('SEP #$20');
    // Body contains %create_smoke() and %erase_block()
    expect(asm).toContain('%create_smoke()');
    expect(asm).toContain('%erase_block()');
    // Restores $9A and $98
    expect(asm).toContain('PLA\n\tSTA $9A\n\tPLA\n\tSTA $98');
  });

  it('generates code for glitter and shatter on neighbour below, left, and right', () => {
    const statementBelow: Statement = {
      type: 'atNeighbour',
      direction: 'below',
      distance: 32,
      body: [{ type: 'action', piece: { id: 'glitter', version: 1, params: {} } }],
    };

    const statementLeft: Statement = {
      type: 'atNeighbour',
      direction: 'left',
      distance: 16,
      body: [{ type: 'action', piece: { id: 'shatter', version: 1, params: { rainbow: false } } }],
    };

    const statementRight: Statement = {
      type: 'atNeighbour',
      direction: 'right',
      distance: 48,
      body: [{ type: 'action', piece: { id: 'shatter', version: 1, params: { rainbow: true } } }],
    };

    const model: BlockModel = {
      ...baseModel,
      slots: {
        marioTop: [statementBelow, statementLeft, statementRight],
      },
    };

    const asm = generate(model, library).text;

    // Below: ADC #$0020 to $98
    expect(asm).toContain('ADC #$0020\n\tSTA $98');
    expect(asm).toContain('%glitter()');

    // Left: SBC #$0010 to $9A
    expect(asm).toContain('SBC #$0010\n\tSTA $9A');
    expect(asm).toContain('%shatter_block()');

    // Right: ADC #$0030 to $9A
    expect(asm).toContain('ADC #$0030\n\tSTA $9A');
    expect(asm).toContain('%rainbow_shatter_block()');
  });

  it('summarizes atNeighbour correctly', () => {
    const statements: Statement[] = [
      {
        type: 'atNeighbour',
        direction: 'above',
        distance: 16,
        body: [
          { type: 'action', piece: { id: 'create_smoke', version: 1, params: {} } },
          { type: 'action', piece: { id: 'erase_block', version: 1, params: {} } },
        ],
      },
    ];

    const summary = summarizeStatements(statements, library);
    expect(summary).toBe('at neighbour (above, 1 block): Create smoke · Erase block');
  });

  it('roundtrips through Blockly workspace serialization', () => {
    const statements: Statement[] = [
      {
        type: 'atNeighbour',
        direction: 'above',
        distance: 32,
        body: [
          { type: 'action', piece: { id: 'create_smoke', version: 1, params: {} } },
          { type: 'action', piece: { id: 'glitter', version: 1, params: {} } },
        ],
      },
    ];

    const workspace = statementsToWorkspace(statements, library);
    const parsed = workspaceToStatements(workspace, library);
    expect(parsed).toEqual(statements);
  });
});
