import { describe, expect, it } from 'vitest';
import { propertyProblems } from './properties';

describe('propertyProblems', () => {
  it('has nothing to say about a good name and a hex number', () => {
    expect(propertyProblems('onoff_cement', '130')).toEqual({});
    expect(propertyProblems('Muncher 2', '25')).toEqual({});
    expect(propertyProblems('a', '$1F0')).toEqual({});
  });

  it('wants a name, because it is the name of the file', () => {
    expect(propertyProblems('', '130').name).toBe(
      'A Block needs a name: it is the name of its file.',
    );
    expect(propertyProblems('   ', '130').name).toBe(
      'A Block needs a name: it is the name of its file.',
    );
  });

  it('says what becomes of characters a Windows file name cannot have', () => {
    expect(propertyProblems('on/off: "cement"?', '130').name).toBe(
      'A file name cannot have / : " ?; they become _ (on_off_ _cement__).',
    );
    expect(propertyProblems('a<b', '130').name).toBe(
      'A file name cannot have <; they become _ (a_b).',
    );
  });

  it('warns about a name Windows would change: a dot or a space at the end', () => {
    expect(propertyProblems('block.', '130').name).toBe(
      'Windows drops a dot at the end of a file name: block.',
    );
    expect(propertyProblems('block ', '130')).toEqual({});
  });

  it('says when the act as is not a hex number, or too big for one', () => {
    expect(propertyProblems('b', 'xyz').defaultActAs).toBe('Not a hex number (like 130).');
    expect(propertyProblems('b', '').defaultActAs).toBe('Not a hex number (like 130).');
    expect(propertyProblems('b', '10000').defaultActAs).toBe('At most FFFF.');
  });

  it('reports both at once', () => {
    expect(Object.keys(propertyProblems('', 'zz'))).toEqual(['name', 'defaultActAs']);
  });
});
