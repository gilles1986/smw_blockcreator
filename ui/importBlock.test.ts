import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../core/testing/library';
import { parseBlockText } from './importBlock';

describe('parseBlockText', () => {
  const library = builtInLibrary();

  it('rejects empty input', () => {
    expect(parseBlockText('', library)).toEqual({
      ok: false,
      message: 'Please paste ASM code or block JSON.',
    });
  });

  it('imports valid ASM text with header', () => {
    const asm = `;bc-format 1
;bc-model {"properties":{"author":"Test","defaultActAs":304,"description":"Testing","name":"test_block"},"slots":{}}
;bc-checksum da95507e

db $42
RTL
`;
    const result = parseBlockText(asm, library);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.properties.name).toBe('test_block');
      expect(result.model.properties.author).toBe('Test');
    }
  });

  it('imports raw JSON directly', () => {
    const json = JSON.stringify({
      properties: { author: 'Dev', defaultActAs: 304, description: 'Direct JSON', name: 'json_block' },
      slots: {},
    });
    const result = parseBlockText(json, library);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.properties.name).toBe('json_block');
    }
  });

  it('reports errors for malformed ASM', () => {
    const result = parseBlockText('random text without header', library);
    expect(result.ok).toBe(false);
  });
});
