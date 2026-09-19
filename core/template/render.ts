// Mustache-subset renderer for Piece templates (ADR 3). Pure string work: no JavaScript evaluation.
//
//   {{name}}                  param value (number as decimal, text verbatim)
//   {{hex name [digits]}}     $-prefixed upper-case hex, padded to `digits` (default: even, ≥ 2)
//   {{signed name}}           -128..127 as a two's-complement byte ($F0)
//   {{lo name}} {{hi name}}   low / high byte of a 16-bit value ($30 / $01)
//   {{ram name}}              an address of the game's RAM as GPS code must write it, SA-1 safe:
//                             $85, $0F44|!addr (also from $7E0F44); any other address as $xxxxxx
//   {{label "name"}}          label unique to this Piece instance (not allowed inside #each)
//   {{false}}                 Conditions only: jump target when the Condition is false
//   {{#if name}}…{{else}}…{{/if}}, {{#each name}}…{{this}}…{{/each}}
//
// A line holding only a block tag is dropped entirely. `this`, `false`, `label` and the helper
// names are reserved: a param with such a name cannot be referenced.
//
// Structure, tag syntax and param names are checked in every branch before rendering, so errors
// surface even in branches that are not rendered. Values are checked while rendering.

export type Value =
  number | string | boolean | readonly Value[] | { readonly [key: string]: Value };

/** Turns a template label name into an ASM label; one factory per Piece instance. */
export type LabelFactory = (name: string) => string;

export interface RenderContext {
  /** Parameter values of this Piece instance. */
  params: Readonly<Record<string, Value>>;
  /** Label factory for this Piece instance: same name → same label, unique across instances. */
  label: LabelFactory;
  /** Conditions only: where `{{false}}` jumps when the Condition is false. */
  falseLabel?: string;
}

export class TemplateError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`line ${line}: ${message}`);
    this.name = 'TemplateError';
  }
}

export function render(template: string, ctx: RenderContext): string {
  const nodes = parseBlock(tokenize(template), { i: 0 }).nodes;
  const scope = new Scope(ctx.params);
  checkReferences(nodes, scope, ctx);
  return evaluate(nodes, scope, ctx);
}

// ---------- tokens ----------

type Token = { kind: 'text'; text: string } | { kind: 'tag'; body: string; line: number };

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let last = 0;
  const pushText = (text: string) => {
    const open = text.indexOf('{{');
    if (open >= 0) {
      throw new TemplateError('{{ is never closed with }}', line + newlines(text.slice(0, open)));
    }
    tokens.push({ kind: 'text', text });
    line += newlines(text);
  };
  for (const match of template.matchAll(/\{\{(.*?)\}\}/g)) {
    pushText(template.slice(last, match.index));
    tokens.push({ kind: 'tag', body: match[1]!.trim(), line });
    last = match.index + match[0].length;
  }
  pushText(template.slice(last));
  stripStandaloneLines(tokens);
  return tokens;
}

function newlines(text: string): number {
  return text.split('\n').length - 1;
}

const BLOCK_TAG = /^(#if|else|\/if|#each|\/each)(\s|$)/;

/**
 * A line holding only a block tag disappears entirely, so templates can put `{{#if}}` on its own line
 * without leaving blank lines in the ASM. Tokens alternate text, tag, text, …, text.
 */
function stripStandaloneLines(tokens: Token[]): void {
  const standalone = tokens.map((token, i) => {
    if (token.kind !== 'tag' || !BLOCK_TAG.test(token.body)) return false;
    const before = (tokens[i - 1] as { text: string }).text;
    const after = (tokens[i + 1] as { text: string }).text;
    const atStart = i - 1 === 0;
    const atEnd = i + 1 === tokens.length - 1;
    const startsLine = /\n[ \t]*$/.test(before) || (atStart && /^[ \t]*$/.test(before));
    const endsLine = /^[ \t]*\r?\n/.test(after) || (atEnd && /^[ \t]*$/.test(after));
    return startsLine && endsLine;
  });
  standalone.forEach((isStandalone, i) => {
    if (!isStandalone) return;
    const before = tokens[i - 1] as { text: string };
    const after = tokens[i + 1] as { text: string };
    before.text = before.text.replace(/[ \t]*$/, '');
    after.text = after.text.replace(/^[ \t]*(\r?\n)?/, '');
  });
}

// ---------- tree ----------

const HELPERS = ['hex', 'signed', 'lo', 'hi', 'ram'] as const;
type Helper = (typeof HELPERS)[number];

/** Names a template cannot reference as params, because they are tags or helpers. */
export const RESERVED_NAMES: readonly string[] = ['this', 'false', 'label', ...HELPERS];

type Node =
  | { kind: 'text'; text: string }
  | { kind: 'value'; name: string; line: number }
  | { kind: 'helper'; helper: Helper; name: string; digits?: number; line: number }
  | { kind: 'label'; name: string }
  | { kind: 'false'; line: number }
  | { kind: 'if'; name: string; expected?: string; line: number; then: Node[]; else: Node[] }
  | { kind: 'each'; name: string; line: number; body: Node[] };

interface OpenBlock {
  head: '#if' | '#each';
  name: string;
  line: number;
  afterElse?: boolean;
}

const NAME = /^[A-Za-z_]\w*$/;

function unquote(text: string): string {
  const match = /^"([^"]*)"$/.exec(text);
  return match ? match[1]! : text;
}

/** Read position in the token list, shared by the recursive `parseBlock` calls. */
interface Cursor {
  i: number;
}

/**
 * Parses until the tag that ends `open` (`{{else}}` or its closing tag), or to the end if nothing
 * is open. `each` is the innermost enclosing `{{#each}}`, if any.
 */
function parseBlock(
  tokens: Token[],
  pos: Cursor,
  open?: OpenBlock,
  each?: OpenBlock,
): { nodes: Node[]; stop?: 'else' } {
  const nodes: Node[] = [];
  while (pos.i < tokens.length) {
    const token = tokens[pos.i++]!;
    if (token.kind === 'text') {
      nodes.push(token);
      continue;
    }
    const { line } = token;
    const [head = '', ...args] = token.body.split(/\s+/);
    switch (head) {
      case '/if':
      case '/each':
        if (!open)
          throw new TemplateError(`{{${head}}} has no matching {{#${head.slice(1)}}}`, line);
        if (open.head !== `#${head.slice(1)}`) {
          throw new TemplateError(
            `{{${head}}} cannot close ${blockTag(open)} from line ${open.line}`,
            line,
          );
        }
        return { nodes };
      case 'else':
        if (open?.head !== '#if') throw new TemplateError('{{else}} outside {{#if}}', line);
        if (open.afterElse) throw new TemplateError(`second {{else}} in ${blockTag(open)}`, line);
        return { nodes, stop: 'else' };
      case '#if': {
        const name = requireName(head, args, line);
        const expected = args[1] !== undefined ? unquote(args[1]) : undefined;
        const block: OpenBlock = { head, name, line };
        const then = parseBlock(tokens, pos, block, each);
        const otherwise =
          then.stop === 'else'
            ? parseBlock(tokens, pos, { ...block, afterElse: true }, each)
            : { nodes: [] };
        nodes.push({
          kind: 'if',
          name,
          expected,
          line,
          then: then.nodes,
          else: otherwise.nodes,
        });
        break;
      }
      case '#each': {
        const block: OpenBlock = { head, name: requireName(head, args, line), line };
        nodes.push({
          kind: 'each',
          name: block.name,
          line,
          body: parseBlock(tokens, pos, block, block).nodes,
        });
        break;
      }
      default:
        nodes.push(inlineTag(head, args, line, each));
    }
  }
  if (open) throw new TemplateError(`${blockTag(open)} is never closed`, open.line);
  return { nodes };
}

function blockTag(block: OpenBlock): string {
  return `{{${block.head} ${block.name}}}`;
}

function inlineTag(head: string, args: string[], line: number, each?: OpenBlock): Node {
  if (head === 'label') {
    if (each) {
      throw new TemplateError(
        `{{label}} cannot be used inside ${blockTag(each)}: the label would repeat`,
        line,
      );
    }
    return { kind: 'label', name: labelName(args, line) };
  }
  if (head === 'false') return { kind: 'false', line };
  if (isHelper(head)) {
    const helper = head;
    const name = requireName(helper, args, line);
    return {
      kind: 'helper',
      helper,
      name,
      line,
      ...(helper === 'hex' && hexDigits(args[1], line)),
    };
  }
  if (args.length > 0) throw new TemplateError(`unknown helper '${head}'`, line);
  if (!NAME.test(head)) throw new TemplateError(`'${head}' is not a valid parameter name`, line);
  return { kind: 'value', name: head, line };
}

function isHelper(head: string): head is Helper {
  return (HELPERS as readonly string[]).includes(head);
}

function requireName(head: string, args: string[], line: number): string {
  const [name] = args;
  if (name === undefined) throw new TemplateError(`${head} needs a parameter name`, line);
  if (!NAME.test(name)) throw new TemplateError(`'${name}' is not a valid parameter name`, line);
  return name;
}

function hexDigits(arg: string | undefined, line: number): { digits?: number } {
  if (arg === undefined) return {};
  if (!/^[1-8]$/.test(arg))
    throw new TemplateError(`hex digit count must be 1 to 8, got '${arg}'`, line);
  return { digits: Number(arg) };
}

function labelName(args: string[], line: number): string {
  const quoted = /^"(.*)"$/.exec(args.join(' '));
  if (!quoted) {
    throw new TemplateError('label needs a quoted name, e.g. {{label "skip"}}', line);
  }
  const name = quoted[1]!;
  if (!/^[A-Za-z]\w*$/.test(name)) {
    throw new TemplateError(
      `label name '${name}' must start with a letter and use only letters, digits and _`,
      line,
    );
  }
  return name;
}

// ---------- evaluation ----------

/** Name lookup: innermost `#each` item first, then outer items, then the Piece params. */
class Scope {
  constructor(
    private readonly values: Readonly<Record<string, Value>>,
    private readonly item?: Value,
    private readonly parent?: Scope,
  ) {}

  child(item: Value): Scope {
    return new Scope(isRecord(item) ? item : {}, item, this);
  }

  lookup(name: string, line: number): Value {
    if (name === 'this') {
      if (this.item === undefined) {
        throw new TemplateError("'this' is only available inside #each", line);
      }
      return this.item;
    }
    if (Object.hasOwn(this.values, name)) return this.values[name]!;
    if (this.parent) return this.parent.lookup(name, line);
    throw new TemplateError(`unknown parameter '${name}'`, line);
  }
}

function isRecord(value: Value): value is { readonly [key: string]: Value } {
  return typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks param names and `{{false}}` in every branch, not only the rendered ones, so a typo cannot
 * hide until a user flips a bool. Inside `{{#each}}` names may refer to item fields, which are
 * only known per item, so there only `{{false}}` is checked.
 */
function checkReferences(nodes: Node[], scope: Scope, ctx: RenderContext, inEach = false): void {
  const check = (name: string, line: number) => {
    if (!inEach) scope.lookup(name, line);
  };
  for (const node of nodes) {
    switch (node.kind) {
      case 'value':
      case 'helper':
        check(node.name, node.line);
        break;
      case 'false':
        falseTarget(node.line, ctx);
        break;
      case 'if':
        check(node.name, node.line);
        checkReferences(node.then, scope, ctx, inEach);
        checkReferences(node.else, scope, ctx, inEach);
        break;
      case 'each':
        check(node.name, node.line);
        checkReferences(node.body, scope, ctx, true);
        break;
    }
  }
}

function evaluate(nodes: Node[], scope: Scope, ctx: RenderContext): string {
  return nodes.map((node) => evaluateNode(node, scope, ctx)).join('');
}

function evaluateNode(node: Node, scope: Scope, ctx: RenderContext): string {
  switch (node.kind) {
    case 'text':
      return node.text;
    case 'value':
      return scalarText(node.name, node.line, scope);
    case 'helper':
      return applyHelper(node, scope);
    case 'label':
      return ctx.label(node.name);
    case 'false':
      return falseTarget(node.line, ctx);
    case 'if': {
      const val = scope.lookup(node.name, node.line);
      const condition = node.expected !== undefined ? String(val) === node.expected : truthy(val);
      return evaluate(condition ? node.then : node.else, scope, ctx);
    }
    case 'each':
      return list(node.name, node.line, scope)
        .map((item) => evaluate(node.body, scope.child(item), ctx))
        .join('');
  }
}

function falseTarget(line: number, ctx: RenderContext): string {
  if (ctx.falseLabel === undefined) {
    throw new TemplateError('{{false}} is only available in Conditions', line);
  }
  return ctx.falseLabel;
}

function scalarText(name: string, line: number, scope: Scope): string {
  const value = scope.lookup(name, line);
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (typeof value === 'boolean') {
    throw new TemplateError(`'${name}' is true/false; use {{#if ${name}}}`, line);
  }
  if (Array.isArray(value)) {
    throw new TemplateError(`'${name}' is a list; use {{#each ${name}}}`, line);
  }
  throw new TemplateError(`'${name}' has fields; name one of them instead`, line);
}

function truthy(value: Value): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function list(name: string, line: number, scope: Scope): readonly Value[] {
  const value = scope.lookup(name, line);
  if (!Array.isArray(value)) {
    throw new TemplateError(`'${name}' must be a list, got ${JSON.stringify(value)}`, line);
  }
  return value;
}

function applyHelper(node: Extract<Node, { kind: 'helper' }>, scope: Scope): string {
  const { name, line } = node;
  switch (node.helper) {
    case 'hex': {
      const value = unsigned(name, line, scope);
      const digits = node.digits ?? minimalEvenDigits(value);
      if (value.toString(16).length > digits) {
        throw new TemplateError(`'${name}' = ${value} does not fit in ${digits} hex digits`, line);
      }
      return formatHex(value, digits);
    }
    case 'signed': {
      const value = integer(name, line, scope);
      if (value < -0x80 || value > 0x7f) {
        throw new TemplateError(`'${name}' = ${value} is not a signed byte (-128..127)`, line);
      }
      return formatHex(value & 0xff, 2);
    }
    case 'lo':
    case 'hi': {
      const value = unsigned(name, line, scope);
      if (value > 0xffff) {
        throw new TemplateError(`'${name}' = ${value} does not fit in 16 bits`, line);
      }
      return formatHex(node.helper === 'lo' ? value & 0xff : value >> 8, 2);
    }
    case 'ram': {
      const value = unsigned(name, line, scope);
      if (value > 0xffffff) {
        throw new TemplateError(`'${name}' = ${value} does not fit in 24 bits`, line);
      }
      return ramOperand(value);
    }
  }
}

/**
 * The game's main RAM is $0000-$1FFF, and bank $7E shows it again. The SA-1 patch moves the direct
 * page ($00-$FF) and the rest of it (through `!addr`), so these are written the portable way; an
 * address anywhere else is left as the author typed it.
 */
function ramOperand(address: number): string {
  const ram = address >= 0x7e0000 && address < 0x7e2000 ? address - 0x7e0000 : address;
  if (ram < 0x100) return formatHex(ram, 2);
  if (ram < 0x2000) return `${formatHex(ram, 4)}|!addr`;
  return formatHex(address, 6);
}

function formatHex(value: number, digits: number): string {
  return '$' + value.toString(16).toUpperCase().padStart(digits, '0');
}

function minimalEvenDigits(value: number): number {
  const length = value.toString(16).length;
  return length + (length % 2);
}

function unsigned(name: string, line: number, scope: Scope): number {
  const value = scope.lookup(name, line);
  if (!isInteger(value) || value < 0) {
    throw new TemplateError(
      `'${name}' must be a non-negative integer, got ${JSON.stringify(value)}`,
      line,
    );
  }
  return value;
}

function integer(name: string, line: number, scope: Scope): number {
  const value = scope.lookup(name, line);
  if (!isInteger(value)) {
    throw new TemplateError(`'${name}' must be an integer, got ${JSON.stringify(value)}`, line);
  }
  return value;
}

function isInteger(value: Value): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
