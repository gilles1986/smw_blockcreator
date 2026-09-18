// Relative branches reach only -128..+127 bytes. Without assembling, the generator bounds each
// line's size from above; a branch that is not surely in range is rewritten as an inverted
// branch around a `JMP` (a block lives in one bank, so `JMP` always reaches).

import type { LabelFactory } from '../template';

const SHORT_BRANCHES = ['BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS', 'BRA'] as const;
type ShortBranch = (typeof SHORT_BRANCHES)[number];

const INVERTED: Record<Exclude<ShortBranch, 'BRA'>, ShortBranch> = {
  BCC: 'BCS',
  BCS: 'BCC',
  BEQ: 'BNE',
  BNE: 'BEQ',
  BMI: 'BPL',
  BPL: 'BMI',
  BVC: 'BVS',
  BVS: 'BVC',
};

/** A statement that is a short branch to a label: `BNE bc3_end`. */
const BRANCH_STATEMENT = new RegExp(`^(${SHORT_BRANCHES.join('|')})\\s+([A-Za-z_][\\w.]*)$`, 'i');

/** 65816 mnemonics; anything else that is not data, a macro call or a define is unbounded. */
const MNEMONICS = new Set(
  (
    'ADC AND ASL BCC BCS BEQ BIT BMI BNE BPL BRA BRK BRL BVC BVS CLC CLD CLI CLV CMP COP CPX CPY ' +
    'DEC DEX DEY EOR INC INX INY JML JMP JSL JSR LDA LDX LDY LSR MVN MVP NOP ORA PEA PEI PER PHA ' +
    'PHB PHD PHK PHP PHX PHY PLA PLB PLD PLP PLX PLY REP ROL ROR RTI RTL RTS SBC SEC SED SEI SEP ' +
    'STA STP STX STY STZ TAX TAY TCD TCS TDC TRB TSB TSC TSX TXA TXS TXY TYA TYX WAI WDM XBA XCE'
  ).split(' '),
);

/** The label a line defines (`name:` at its start), if any. */
function labelOf(line: string): string | undefined {
  return /^([^\s:;"]+):/.exec(line)?.[1];
}

/** The code of a line without its comment; a `;` inside a string is not a comment. */
function withoutComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inString = !inString;
    else if (line[i] === ';' && !inString) return line.slice(0, i);
  }
  return line;
}

/** Splits at ` : ` outside strings (Asar's statement separator). */
function statementsOf(code: string): string[] {
  const statements: string[] = [];
  let inString = false;
  let start = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '"') inString = !inString;
    else if (!inString && code.startsWith(' : ', i)) {
      statements.push(code.slice(start, i));
      start = i + 3;
      i += 2;
    }
  }
  statements.push(code.slice(start));
  return statements.map((statement) => statement.trim()).filter((s) => s !== '');
}

/** At most how many bytes a line of generated code assembles to (Infinity if unknown). */
export function maxBytes(line: string): number {
  const code = withoutComment(line).trim();
  const label = labelOf(code);
  const rest = label === undefined ? code : code.slice(label.length + 1).trim();
  return statementsOf(rest).reduce((total, statement) => total + statementBytes(statement), 0);
}

function statementBytes(statement: string): number {
  const [word = '', ...rest] = statement.split(/\s+/);
  const operand = rest.join(' ');
  const [mnemonic = '', width] = word.toUpperCase().split('.');
  // `rep n : …` is Asar's repeat directive; the REP instruction always takes `#`.
  if (mnemonic === 'REP' && !operand.startsWith('#')) return Infinity;
  if (MNEMONICS.has(mnemonic)) return instructionBytes(mnemonic, width, operand);
  if (word.startsWith('%')) return 4; // GPS routine macro: a JSL
  if (word.startsWith('!')) return 0; // define
  if (/^print$/i.test(word)) return 0;
  const size = { DB: 1, DW: 2, DL: 3, DD: 4 }[word.toUpperCase()];
  return size ? dataBytes(operand, size) : Infinity;
}

/** `db $01, "AB"`: numbers take `size` bytes each, strings one byte per character. */
function dataBytes(operand: string, size: number): number {
  let total = 0;
  for (const item of operand.match(/"[^"]*"|[^,]+/g) ?? []) {
    const text = item.trim();
    total += text.startsWith('"') ? text.length - 2 : size;
  }
  return total;
}

function instructionBytes(mnemonic: string, width: string | undefined, operand: string): number {
  if (operand === '' || operand.toUpperCase() === 'A') return 1;
  if ((SHORT_BRANCHES as readonly string[]).includes(mnemonic)) return 2;
  if (['BRL', 'PER', 'MVN', 'MVP', 'PEA', 'JSR'].includes(mnemonic)) return 3;
  if (['JML', 'JSL'].includes(mnemonic)) return 4;
  if (width) return { B: 2, W: 3, L: 4 }[width.toUpperCase()] ?? 4;
  if (operand.startsWith('#'))
    return ['REP', 'SEP', 'COP', 'BRK', 'WDM'].includes(mnemonic) ? 2 : 3;
  return addressBytes(operand) ?? (mnemonic === 'JMP' ? 3 : 4);
}

/**
 * Size of a plain `$hex` address operand with an optional GPS/SA-1 suffix and index, or
 * undefined when the operand is anything else (labels, defines, arithmetic).
 */
function addressBytes(operand: string): number | undefined {
  const match = /^[([]?\$([0-9a-f]+)(\|!(addr|bank|dp))?[\])]?(,[xys]\)?)?(,[xy])?$/i.exec(operand);
  if (!match) return undefined;
  const suffix = match[3]?.toLowerCase();
  if (suffix === 'bank') return 4; // `|!bank` makes a long address
  if (suffix === 'addr' || suffix === 'dp') return 3; // SA-1 remaps both into absolute range
  const digits = match[1]!.length;
  return digits <= 2 ? 2 : digits <= 4 ? 3 : 4;
}

/**
 * Rewrites short branches to labels defined in `lines` that may be out of range, until none is.
 * `origins` runs parallel to `lines` and is kept in step; `newLabels` names the skip labels.
 */
export function widenBranches<T>(
  lines: readonly string[],
  origins: readonly T[],
  newLabels: () => LabelFactory,
): { lines: string[]; origins: T[] } {
  let current = splitBranches({ lines: [...lines], origins: [...origins] });
  for (;;) {
    const far = farBranches(current.lines);
    if (far.size === 0) return current;
    // Rewrite every far branch in one go: code only grows, so none of them becomes near again.
    // The rewrites can push other branches out of range, hence the loop. A rewritten branch
    // only skips its `JMP`, so it is never far again: the loop ends.
    const next = { lines: [] as string[], origins: [] as T[] };
    current.lines.forEach((line, i) => {
      const replacement = far.has(i) ? widen(line, newLabels()) : [line];
      next.lines.push(...replacement);
      next.origins.push(...replacement.map(() => current.origins[i]!));
    });
    current = next;
  }
}

/** Indices of branch lines whose target may lie beyond -128..+127 bytes. */
function farBranches(lines: readonly string[]): Set<number> {
  const labels = new Map<string, number>();
  lines.forEach((line, i) => {
    const label = labelOf(line);
    if (label !== undefined) labels.set(label, i);
  });
  // Byte sums as prefix sums, with lines of unknown size counted separately: a range that
  // contains one is unbounded (no Infinity - Infinity).
  const bytes = [0];
  const unknown = [0];
  lines.forEach((line, i) => {
    const size = maxBytes(line);
    bytes.push(bytes[i]! + (Number.isFinite(size) ? size : 0));
    unknown.push(unknown[i]! + (Number.isFinite(size) ? 0 : 1));
  });
  /** Bytes of lines from..to-1. */
  const span = (from: number, to: number) =>
    unknown[to]! - unknown[from]! > 0 ? Infinity : bytes[to]! - bytes[from]!;
  const far = new Set<number>();
  lines.forEach((line, i) => {
    const branch = endingBranch(line);
    const target = branch && labels.get(branch.target);
    if (branch === undefined || target === undefined) return;
    // Forward: the lines in between. Backward: the target's line up to and including this one.
    const reach = target > i ? span(i + 1, target) : span(target, i + 1);
    if (reach > (target > i ? 127 : 128)) far.add(i);
  });
  return far;
}

/** The branch a line ends with, if its last statement is a short branch to a label. */
function endingBranch(
  line: string,
): { prefix: string; op: ShortBranch; target: string } | undefined {
  if (labelOf(line) !== undefined) return undefined;
  const statements = statementsOf(withoutComment(line));
  const match = BRANCH_STATEMENT.exec(statements.at(-1) ?? '');
  if (!match) return undefined;
  const prefix = statements
    .slice(0, -1)
    .map((s) => `${s} : `)
    .join('');
  return { prefix, op: match[1]!.toUpperCase() as ShortBranch, target: match[2]! };
}

/** Breaks lines after any branch that is not their last statement, so every branch ends a line. */
function splitBranches<T>(code: { lines: string[]; origins: T[] }): {
  lines: string[];
  origins: T[];
} {
  const out = { lines: [] as string[], origins: [] as T[] };
  code.lines.forEach((line, i) => {
    const statements = labelOf(line) === undefined ? statementsOf(withoutComment(line)) : [];
    const cut = statements.findIndex(
      (s, k) => k < statements.length - 1 && BRANCH_STATEMENT.test(s),
    );
    if (cut < 0) {
      out.lines.push(line);
      out.origins.push(code.origins[i]!);
      return;
    }
    const parts = [statements.slice(0, cut + 1), statements.slice(cut + 1)];
    for (const part of parts) {
      out.lines.push(`\t${part.join(' : ')}`);
      out.origins.push(code.origins[i]!);
    }
  });
  // A split tail can hold another branch before its end; split until every branch ends a line.
  return out.lines.length === code.lines.length ? out : splitBranches(out);
}

function widen(line: string, label: LabelFactory): string[] {
  const { prefix, op, target } = endingBranch(line)!;
  if (op === 'BRA') return [`\t${prefix}JMP ${target}`];
  const skip = label('skip');
  return [`\t${prefix}${INVERTED[op]} ${skip}`, `\tJMP ${target}`, `${skip}:`];
}
