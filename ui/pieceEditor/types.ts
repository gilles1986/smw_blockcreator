import type { Manifest, ParamSpec, Register } from '../../core/library';

export const BUILTIN_CATEGORIES = [
  { id: 'conditions', label: 'Conditions' },
  { id: 'physics', label: 'Physics / Movement' },
  { id: 'damage', label: 'Damage / Life' },
  { id: 'effects', label: 'Effects / Visuals' },
  { id: 'sound', label: 'Sound / Music' },
  { id: 'sprites', label: 'Sprites' },
  { id: 'level', label: 'Level Flags / Environment' },
  { id: 'advanced', label: 'Advanced' },
] as const;

export const DEFAULT_ACTION_TEMPLATE = `; Action code runs when this slot fires.
; Example: give 5 coins
LDA $0DBF|!addr
CLC
ADC #$05
STA $0DBF|!addr
`;

export const DEFAULT_CONDITION_TEMPLATE = `; Condition code: falls through when true, jumps to {{false}} when false.
; Example: check if ON/OFF switch is ON
LDA $14AF|!addr
BEQ {{false}}
`;

export interface PieceFormData {
  kind: 'action' | 'condition';
  id: string;
  name: string;
  category: string;
  customCategory: string;
  description: string;
  author: string;
  credits: string;
  slots: 'any' | 'mario' | 'sprite';
  clobbersA: boolean;
  clobbersX: boolean;
  clobbersY: boolean;
  once: boolean;
  removesBlock: boolean;
  routines: string;
  params: ParamSpec[];
  template: string;
}

/** How often an Action should run while its block is touched: the two flags as one choice. */
export type Frequency = 'every' | 'once' | 'removes';

export function frequencyOf(data: Pick<PieceFormData, 'once' | 'removesBlock'>): Frequency {
  if (data.removesBlock) return 'removes';
  return data.once ? 'once' : 'every';
}

/** A Piece that removes the block is flagged `once` too, as the built-in ones are. */
export function frequencyFlags(frequency: Frequency): Pick<PieceFormData, 'once' | 'removesBlock'> {
  return { once: frequency !== 'every', removesBlock: frequency === 'removes' };
}

export function formDataToManifest(data: PieceFormData): Manifest {
  const clobbers: Register[] = [];
  if (data.clobbersA) clobbers.push('A');
  if (data.clobbersX) clobbers.push('X');
  if (data.clobbersY) clobbers.push('Y');

  const category =
    data.category === 'custom'
      ? data.customCategory
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_') || 'custom'
      : data.category;

  const routines = data.routines
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  return {
    id: data.id.trim(),
    version: 1,
    kind: data.kind,
    category,
    name: data.name.trim(),
    description: data.description.trim(),
    author: data.author.trim(),
    ...(data.credits.trim() ? { credits: data.credits.trim() } : {}),
    slots: data.slots,
    params: data.params,
    clobbers,
    once: Boolean(data.kind === 'action' && data.once),
    removesBlock: Boolean(data.kind === 'action' && data.removesBlock),
    routines,
  };
}

export function manifestToFormData(manifest: Manifest, template: string): PieceFormData {
  const isBuiltinCat = BUILTIN_CATEGORIES.some((c) => c.id === manifest.category);
  return {
    kind: manifest.kind,
    id: manifest.id,
    name: manifest.name,
    category: isBuiltinCat ? manifest.category : 'custom',
    customCategory: isBuiltinCat ? '' : manifest.category,
    description: manifest.description,
    author: manifest.author,
    credits: manifest.credits ?? '',
    slots: manifest.slots,
    clobbersA: manifest.clobbers.includes('A'),
    clobbersX: manifest.clobbers.includes('X'),
    clobbersY: manifest.clobbers.includes('Y'),
    once: manifest.once ?? false,
    removesBlock: manifest.removesBlock ?? false,
    routines: manifest.routines?.join(', ') ?? '',
    params: manifest.params ? JSON.parse(JSON.stringify(manifest.params)) : [],
    template,
  };
}

export function initialFormData(kind: 'action' | 'condition', defaultAuthor = ''): PieceFormData {
  return {
    kind,
    id: kind === 'condition' ? 'c_my_check' : 'my_action',
    name: kind === 'condition' ? 'My Condition' : 'My Action',
    category: kind === 'condition' ? 'conditions' : 'physics',
    customCategory: '',
    description: '',
    author: defaultAuthor,
    credits: '',
    slots: 'any',
    clobbersA: true,
    clobbersX: false,
    clobbersY: false,
    once: false,
    removesBlock: false,
    routines: '',
    params: [],
    template: kind === 'condition' ? DEFAULT_CONDITION_TEMPLATE : DEFAULT_ACTION_TEMPLATE,
  };
}
