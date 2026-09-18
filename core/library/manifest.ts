// Piece manifest (`piece.json`) as described in the spec, "Pieces and Library".

export type ParamType =
  'number' | 'enum' | 'bool' | 'map16' | 'sprite' | 'sound' | 'text' | 'multiline';

export interface EnumOption {
  value: number | string;
  label: string;
}

export interface ParamSpec {
  name: string;
  label: string;
  type: ParamType;
  default: number | string | boolean;
  /** number only */
  min?: number;
  max?: number;
  format?: 'hex' | 'dec';
  /** enum only */
  options?: EnumOption[];
}

export type Register = 'A' | 'X' | 'Y';

export interface Manifest {
  id: string;
  version: number;
  kind: 'action' | 'condition';
  category: string;
  name: string;
  description: string;
  author: string;
  credits?: string;
  icon?: string;
  slots: 'mario' | 'sprite' | 'any';
  params: ParamSpec[];
  once: boolean;
  removesBlock: boolean;
  clobbers: Register[];
  routines: string[];
}

type OptionalField = 'once' | 'removesBlock' | 'routines';

/** `piece.json` as written: the flags and lists above may be left out and default to false / []. */
export type ManifestJson = Omit<Manifest, OptionalField> & Partial<Pick<Manifest, OptionalField>>;
