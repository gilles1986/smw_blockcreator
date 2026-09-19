// One-line summaries of a Slot's logic for the Slot rows of the editor (the prototype's overview:
// "act as 130 · if ON/OFF is ON: …"). Written from the manifests, so every Piece has one without
// saying anything: its name and what is worth saying about its values.

import type { Library, ParamSpec } from '../library';
import type { ConditionExpr, PieceRef, Statement } from '../model';
import { BUILT_IN_NAMES, type NameSource } from '../names';
import type { Value } from '../template';

/** The longest piece of text (a Custom ASM line, say) a summary quotes. */
const TEXT_MAX = 24;

/** Statements as one line: Actions joined by `·`, an `if` as `if X: … else if Y: … else: …`. */
export function summarizeStatements(
  statements: readonly Statement[],
  library: Library,
  names: NameSource = BUILT_IN_NAMES,
): string {
  return statements
    .map((statement) => summarizeStatement(statement, library, names))
    .filter((text) => text !== '')
    .join(' · ');
}

/** A Condition as the text between `if` and the colon: `not X`, `(X and Y)`. */
export function summarizeCondition(
  expr: ConditionExpr,
  library: Library,
  names: NameSource = BUILT_IN_NAMES,
): string {
  switch (expr.type) {
    case 'condition':
      return summarizePiece(expr.piece, library, names);
    case 'not':
      return `not ${summarizeCondition(expr.condition, library, names)}`;
    case 'and':
    case 'or':
      return `(${summarizeCondition(expr.left, library, names)} ${expr.type} ${summarizeCondition(expr.right, library, names)})`;
  }
}

/**
 * A Piece use: its name, then its values. A Piece with one or two parameters says them all
 * (`Act as 130`); one with more says only what is not the default, with the labels
 * (`Boost Mario (horizontal push Left, X strength 16)`). A parameter the block hides
 * (`showWhen`) says nothing. A Piece the Library does not have is `? id`.
 */
export function summarizePiece(
  ref: PieceRef,
  library: Library,
  names: NameSource = BUILT_IN_NAMES,
): string {
  const piece = library.pieces.get(ref.id);
  if (!piece) return `? ${ref.id}`;
  const { name, params } = piece.manifest;
  const few = params.length <= 2;
  const value = (param: ParamSpec): Value => ref.params[param.name] ?? param.default;
  const said = params.flatMap((param) => {
    if (hidden(param, params, value)) return [];
    const text = valueText(param, value(param), value, names);
    if (text === undefined) return [];
    // Say everything when there is little, else only what was changed.
    if (param.type === 'bool') return value(param) === param.default ? [] : [text];
    if (!few && value(param) === param.default) return [];
    return [few ? text : `${labelText(param)} ${text}`];
  });
  if (said.length === 0) return name;
  return few ? `${name} ${said.join(', ')}` : `${name} (${said.join(', ')})`;
}

function summarizeStatement(statement: Statement, library: Library, names: NameSource): string {
  if (statement.type === 'action') return summarizePiece(statement.piece, library, names);
  const body = (list: readonly Statement[]) => summarizeStatements(list, library, names) || '—';
  const parts = statement.branches.map(
    (branch, i) =>
      `${i === 0 ? 'if' : 'else if'} ${summarizeCondition(branch.condition, library, names)}: ${body(branch.body)}`,
  );
  if (statement.else) parts.push(`else: ${body(statement.else)}`);
  return parts.join(' ');
}

/** A parameter the block does not show right now (`showWhen`). */
function hidden(
  param: ParamSpec,
  params: readonly ParamSpec[],
  value: (param: ParamSpec) => Value,
): boolean {
  const rule = param.showWhen;
  if (!rule) return false;
  const control = params.find((other) => other.name === rule.param);
  return !control || String(value(control)) !== String(rule.equals);
}

/** How a value reads in a summary; undefined when there is nothing to say. */
function valueText(
  param: ParamSpec,
  value: Value,
  valueOf: (param: ParamSpec) => Value,
  names: NameSource,
): string | undefined {
  switch (param.type) {
    case 'bool':
      return value ? lowerFirst(param.label) : `not ${lowerFirst(param.label)}`;
    case 'enum':
      return param.options?.find((option) => option.value === value)?.label ?? String(value);
    case 'number':
      return typeof value === 'number' && param.format === 'hex' ? hex(value) : String(value);
    case 'map16':
      return typeof value === 'number' ? value.toString(16).toUpperCase().padStart(3, '0') : '';
    case 'sprite': {
      const custom = param.listParam ? Boolean(valueOf(listOf(param))) : false;
      return nameOrHex(names.sprites(custom), value);
    }
    case 'sound': {
      const port = param.listParam ? String(valueOf(listOf(param))) : '';
      return nameOrHex(names.sounds(port), value);
    }
    case 'text':
    case 'multiline': {
      const [first = '', ...more] = String(value).split('\n');
      const text = first.trim();
      if (text === '') return undefined;
      return (
        (text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX)}…` : text) +
        (more.length > 0 && text.length <= TEXT_MAX ? '…' : '')
      );
    }
  }
}

/** The parameter another one (`listParam`) names, as a stand-in spec for looking its value up. */
function listOf(param: ParamSpec): ParamSpec {
  return { name: param.listParam!, label: '', type: 'bool', default: false };
}

function nameOrHex(named: readonly { id: number; name: string }[], value: Value): string {
  return named.find((entry) => entry.id === value)?.name ?? hex(Number(value));
}

/** `$85`, `$0F44`: upper-case hex with an even number of digits, at least two. */
function hex(value: number): string {
  const digits = value.toString(16).toUpperCase();
  return `$${digits.padStart(digits.length + (digits.length % 2), '0')}`;
}

/** A label as part of a sentence: no range in brackets at the end, first letter lower case. */
function labelText(param: ParamSpec): string {
  return lowerFirst(param.label.replace(/\s*\([^)]*\)\s*$/, ''));
}

/** `Sprite number` → `sprite number`, but not `X speed` or `ON/OFF`. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}
