import { describe, expect, it } from 'vitest';
import { formatHex, hexInput, parseHex } from './hex';

describe('hex', () => {
  it('formats upper-case, padded, without $', () => {
    expect(formatHex(0x25, 3)).toBe('025');
    expect(formatHex(0x1f0, 3)).toBe('1F0');
    expect(formatHex(0x1234, 3)).toBe('1234');
  });

  it('parses with or without $, ignoring case and spaces', () => {
    expect(parseHex(' $1f0 ')).toBe(0x1f0);
    expect(parseHex('130')).toBe(0x130);
    expect(parseHex('xyz')).toBeUndefined();
    expect(parseHex('')).toBeUndefined();
  });

  it('accepts field input within range and normalises it; rejects the rest with null', () => {
    const tile = hexInput(0, 0xffff);
    expect(tile('$1f0')).toBe('1F0');
    expect(tile('xyz')).toBeNull();
    expect(tile('10000')).toBeNull();
    expect(hexInput(0x10, 0x7f)('0F')).toBeNull();
  });
});
