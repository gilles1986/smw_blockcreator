// How each Piece parameter type appears as a Blockly field, in both directions: the field
// definition, the field value for a parameter value, and back. One place, so they cannot drift.

import type { ParamSpec } from '../../core/library';
import type { Value } from '../../core/template';
import { formatHex, hexInput, parseHex } from '../hex';

export type FieldDefinition =
  | { type: 'field_input'; name: string; text: string }
  | { type: 'field_multilinetext'; name: string; text: string }
  | { type: 'field_number'; name: string; value: number; min: number; max: number; precision: 1 }
  | { type: 'field_dropdown'; name: string; options: [string, string][] }
  | { type: 'field_checkbox'; name: string; checked: boolean };

/** A value as Blockly serialises it in `fields`. */
export type FieldValue = string | number | boolean;

interface FieldCodec {
  definition(param: ParamSpec): FieldDefinition;
  toField(value: Value): FieldValue;
  /** Undefined when the field holds nothing usable; callers fall back to the default. */
  fromField(raw: unknown): Value | undefined;
  /** Blockly validator for text fields that hold numbers. */
  validator?: (text: string) => string | null;
}

export function fieldCodec(param: ParamSpec): FieldCodec {
  const { name } = param;
  switch (param.type) {
    case 'map16':
      return hexCodec(name, 3, 0, 0xffff);
    case 'number':
      return param.format === 'hex'
        ? hexCodec(name, 2, param.min ?? 0, param.max ?? 0)
        : numberCodec(name, param.min ?? 0, param.max ?? 0);
    case 'sprite':
    case 'sound':
      return numberCodec(name, 0, 0xff);
    case 'enum': {
      const options = param.options ?? [];
      return {
        definition: () => ({
          type: 'field_dropdown',
          name,
          options: options.map((option) => [option.label, String(option.value)]),
        }),
        toField: (value) => String(value),
        fromField: (raw) => options.find((option) => String(option.value) === String(raw))?.value,
      };
    }
    case 'bool':
      return {
        definition: (p) => ({ type: 'field_checkbox', name, checked: p.default as boolean }),
        toField: (value) => (value ? 'TRUE' : 'FALSE'),
        fromField: (raw) => raw === true || raw === 'TRUE',
      };
    case 'text':
    case 'multiline': {
      const type = param.type === 'text' ? 'field_input' : 'field_multilinetext';
      return {
        definition: (p) => ({ type, name, text: String(p.default) }),
        toField: (value) => String(value),
        fromField: (raw) => String(raw),
      };
    }
  }
}

function hexCodec(name: string, digits: number, min: number, max: number): FieldCodec {
  return {
    definition: (p) => ({
      type: 'field_input',
      name,
      text: formatHex(p.default as number, digits),
    }),
    toField: (value) => formatHex(value as number, digits),
    fromField: (raw) => {
      const value = parseHex(String(raw));
      return value !== undefined && value >= min && value <= max ? value : undefined;
    },
    validator: hexInput(min, max),
  };
}

function numberCodec(name: string, min: number, max: number): FieldCodec {
  return {
    definition: (p) => ({
      type: 'field_number',
      name,
      value: p.default as number,
      min,
      max,
      precision: 1,
    }),
    toField: (value) => value as number,
    fromField: (raw) => {
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    },
  };
}
