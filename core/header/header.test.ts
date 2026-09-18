import { describe, expect, it } from 'vitest';
import { bodyChecksum, checksum } from './index';

describe('checksum', () => {
  // Reference values of 32-bit FNV-1a (http://www.isthe.com/chongo/tech/comp/fnv/).
  it.each([
    ['', '811c9dc5'],
    ['a', 'e40c292c'],
    ['foobar', 'bf9cf968'],
  ])('hashes %j to %s', (text, expected) => {
    expect(checksum(text)).toBe(expected);
  });

  it('hashes UTF-8 bytes (ä = C3 A4), so non-ASCII text is stable across platforms', () => {
    expect(checksum('ä')).toBe('199de0e2');
  });
});

describe('bodyChecksum', () => {
  it('ignores line-ending conversions and a lost final newline, which are not hand edits', () => {
    const body = ';\n; name\ndb $42\n';
    expect(bodyChecksum(';\r\n; name\r\ndb $42\r\n')).toBe(bodyChecksum(body));
    expect(bodyChecksum(';\n; name\ndb $42')).toBe(bodyChecksum(body));
    expect(bodyChecksum(body)).toBe(checksum(body));
  });

  it('changes when the code changes', () => {
    expect(bodyChecksum('db $42\nRTL\n')).not.toBe(bodyChecksum('db $42\nRTS\n'));
  });
});
