// A very small 65816 interpreter for the rendered templates of Pieces, so a test can run the code
// of a Piece against a RAM map and look at the result instead of at the text. 8-bit registers, the
// flags N, Z and C, and only the instructions the Pieces use. Anything else throws: a Piece that
// starts using another instruction fails its test loudly instead of passing without being run.

export interface Machine {
  a?: number;
  x?: number;
  y?: number;
  /** RAM by address; what is not there reads as 0. Direct page and `|!addr` are the same map. */
  ram?: Record<number, number>;
  /** ROM bytes by 24-bit address, for `AND.l $0DA8A6,x` and the like. */
  rom?: Record<number, number>;
  /** What `JSL $01ACF9` (GetRand) leaves in `$148D`. */
  random?: number;
  /** The label a Condition jumps to when it is false; it is not defined in the code. */
  falseLabel?: string;
}

export interface Outcome {
  a: number;
  x: number;
  y: number;
  ram: Record<number, number>;
  /** Routine calls in order: `JSL $00F606`, `%create_smoke()`. */
  calls: string[];
  /** The code jumped to `falseLabel`. */
  falseTaken: boolean;
}

const MAX_STEPS = 10_000;

/** The number of sprite slots of LoROM, what `!sprite_slots` is there. */
const SPRITE_SLOTS = 12;

/** A number: `$1F`, `%0101`, `31`, a sprite table `!14C8`, `!sprite_slots`, and `a-1`, `a+1`. */
function number(text: string): number {
  if (text.startsWith('-')) return -number(text.slice(1));
  const sum = /^(.+?)([+-])(\d+)$/.exec(text);
  if (sum) return number(sum[1]!) + (sum[2] === '-' ? -1 : 1) * parseInt(sum[3]!, 10);
  if (text === '!sprite_slots') return SPRITE_SLOTS;
  if (text.startsWith('!')) return parseInt(text.slice(1), 16);
  if (text.startsWith('$')) return parseInt(text.slice(1), 16);
  if (text.startsWith('%')) return parseInt(text.slice(1), 2);
  return parseInt(text, 10);
}

interface Operand {
  immediate: boolean;
  value: number;
  index: 'x' | 'y' | undefined;
}

function operand(text: string): Operand {
  let rest = text.replace(/\|!(addr|bank)/gi, '').trim();
  let index: Operand['index'];
  const indexed = /,\s*([xy])$/i.exec(rest);
  if (indexed) {
    index = indexed[1]!.toLowerCase() as 'x' | 'y';
    rest = rest.slice(0, indexed.index).trim();
  }
  const immediate = rest.startsWith('#');
  if (immediate) rest = rest.slice(1);
  return { immediate, value: number(rest), index };
}

export function run(asm: string, machine: Machine = {}): Outcome {
  const ram: Record<number, number> = { ...machine.ram };
  const calls: string[] = [];
  const stack: number[] = [];
  let a = machine.a ?? 0;
  let x = machine.x ?? 0;
  let y = machine.y ?? 0;
  let carry = false;
  let zero = false;
  let negative = false;

  const program: { op: string; raw: string; arg: string }[] = [];
  const labels = new Map<string, number>();
  for (const raw of asm.split('\n')) {
    // Several instructions on a line are separated by ` : `.
    for (const part of raw.replace(/;.*$/, '').split(/\s+:\s+/)) {
      const line = part.trim();
      if (line === '') continue;
      if (line.endsWith(':')) {
        labels.set(line.slice(0, -1), program.length);
        continue;
      }
      const [op = '', ...rest] = line.split(/\s+/);
      // `AND.l`, `LDA.w`: the width of the address does not matter to the model.
      program.push({ op: op.toUpperCase().replace(/\.[BWL]$/, ''), raw: op, arg: rest.join(' ') });
    }
  }

  const read = (o: Operand): number => {
    if (o.immediate) return o.value & 0xff;
    const at = o.value + (o.index === 'x' ? x : o.index === 'y' ? y : 0);
    // Above the 64K of RAM and the direct page it is ROM.
    if (at > 0xffff) return (machine.rom?.[at] ?? 0) & 0xff;
    return (ram[at] ?? 0) & 0xff;
  };
  const write = (o: Operand, value: number) => {
    ram[o.value + (o.index === 'x' ? x : o.index === 'y' ? y : 0)] = value & 0xff;
  };
  const flags = (value: number): number => {
    zero = (value & 0xff) === 0;
    negative = (value & 0x80) !== 0;
    return value & 0xff;
  };
  const compare = (register: number, o: Operand) => {
    const value = read(o);
    carry = register >= value;
    flags(register - value);
  };

  let falseTaken = false;
  const jump = (label: string): number | 'end' => {
    if (label === machine.falseLabel) {
      falseTaken = true;
      return 'end';
    }
    const target = labels.get(label);
    if (target === undefined) throw new Error(`no label ${label}`);
    return target;
  };

  let pc = 0;
  for (let steps = 0; pc < program.length; steps++) {
    if (steps > MAX_STEPS) throw new Error('the code does not end');
    const { op, raw, arg } = program[pc++]!;
    let next: number | 'end' | undefined;
    switch (op) {
      case 'LDA':
        a = flags(read(operand(arg)));
        break;
      case 'LDX':
        x = flags(read(operand(arg)));
        break;
      case 'LDY':
        y = flags(read(operand(arg)));
        break;
      case 'STA':
        write(operand(arg), a);
        break;
      case 'STX':
        write(operand(arg), x);
        break;
      case 'STY':
        write(operand(arg), y);
        break;
      case 'STZ':
        write(operand(arg), 0);
        break;
      case 'CLC':
        carry = false;
        break;
      case 'SEC':
        carry = true;
        break;
      case 'ADC': {
        const sum: number = a + read(operand(arg)) + (carry ? 1 : 0);
        carry = sum > 0xff;
        a = flags(sum);
        break;
      }
      case 'SBC': {
        const difference: number = a - read(operand(arg)) - (carry ? 0 : 1);
        carry = difference >= 0;
        a = flags(difference);
        break;
      }
      case 'CMP':
        compare(a, operand(arg));
        break;
      case 'CPX':
        compare(x, operand(arg));
        break;
      case 'CPY':
        compare(y, operand(arg));
        break;
      case 'AND':
        a = flags(a & read(operand(arg)));
        break;
      case 'ORA':
        a = flags(a | read(operand(arg)));
        break;
      case 'EOR':
        a = flags(a ^ read(operand(arg)));
        break;
      case 'INC':
        if (arg === '') a = flags(a + 1);
        else write(operand(arg), flags(read(operand(arg)) + 1));
        break;
      case 'DEC':
        if (arg === '') a = flags(a - 1);
        else write(operand(arg), flags(read(operand(arg)) - 1));
        break;
      case 'INX':
        x = flags(x + 1);
        break;
      case 'DEX':
        x = flags(x - 1);
        break;
      case 'INY':
        y = flags(y + 1);
        break;
      case 'DEY':
        y = flags(y - 1);
        break;
      case 'TAX':
        x = flags(a);
        break;
      case 'TAY':
        y = flags(a);
        break;
      case 'TXA':
        a = flags(x);
        break;
      case 'TYA':
        a = flags(y);
        break;
      case 'LSR':
        carry = (a & 1) !== 0;
        a = flags(a >> 1);
        break;
      case 'ASL':
        carry = (a & 0x80) !== 0;
        a = flags(a << 1);
        break;
      case 'TRB': {
        // Z is set when A and the byte have no bit in common; then the bits of A are cleared.
        const target = operand(arg);
        const value = read(target);
        zero = (a & value) === 0;
        write(target, value & ~a);
        break;
      }
      case 'TSB': {
        const target = operand(arg);
        const value = read(target);
        zero = (a & value) === 0;
        write(target, value | a);
        break;
      }
      case 'PHA':
        stack.push(a);
        break;
      case 'PLA':
        a = flags(stack.pop()!);
        break;
      case 'PHX':
        stack.push(x);
        break;
      case 'PLX':
        x = flags(stack.pop()!);
        break;
      case 'PHY':
        stack.push(y);
        break;
      case 'PLY':
        y = flags(stack.pop()!);
        break;
      case 'NOP':
        break;
      case 'BRA':
        next = jump(arg);
        break;
      case 'BEQ':
        if (zero) next = jump(arg);
        break;
      case 'BNE':
        if (!zero) next = jump(arg);
        break;
      case 'BCC':
        if (!carry) next = jump(arg);
        break;
      case 'BCS':
        if (carry) next = jump(arg);
        break;
      case 'BMI':
        if (negative) next = jump(arg);
        break;
      case 'BPL':
        if (!negative) next = jump(arg);
        break;
      case 'JSL':
        calls.push(`JSL ${arg.replace(/\|!bank/i, '')}`);
        if (/^\$01ACF9/i.test(arg)) ram[0x148d] = machine.random ?? 0;
        break;
      default:
        if (op.startsWith('%')) {
          calls.push(`${raw}${arg ? ' ' + arg : ''}`);
          break;
        }
        throw new Error(`the mini interpreter has no ${op} ${arg}`);
    }
    if (next === 'end') break;
    if (next !== undefined) pc = next;
  }
  return { a, x, y, ram, calls, falseTaken };
}
