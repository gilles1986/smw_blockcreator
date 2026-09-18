// Hex numbers as the UI shows them: upper-case, no `$` (Map16 numbers read as 025, 130, …).

export function formatHex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, '0');
}

/** Parses hex with or without `$`; undefined unless the whole text is hex. */
export function parseHex(text: string): number | undefined {
  const digits = text.trim().replace(/^\$/, '');
  return /^[0-9a-f]+$/i.test(digits) ? parseInt(digits, 16) : undefined;
}

/**
 * A validator for hex text fields: returns the normalised text, or null (Blockly's "reject")
 * when the text is not hex or outside `min..max`.
 */
export function hexInput(min: number, max: number): (text: string) => string | null {
  return (text) => {
    const value = parseHex(text);
    if (value === undefined || value < min || value > max) return null;
    return text.trim().replace(/^\$/, '').toUpperCase();
  };
}
