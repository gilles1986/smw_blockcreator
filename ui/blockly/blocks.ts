// Blockly block definitions (JSON) built from Piece manifests. Pure data: no Blockly import, so
// it can be tested without a DOM. BlocklyEditor hands them to Blockly.

import type { Library, Piece } from '../../core/library';
import type { Value } from '../../core/template';
import { categoryColour, type Colour } from './categories';
import { fieldCodec, type FieldDefinition, type FieldValue } from './fields';

/** Blockly block type of a Piece. */
export function pieceBlockType(id: string): string {
  return `piece_${id}`;
}

/** Piece id of a Blockly block type, or undefined for non-Piece blocks such as `controls_if`. */
export function pieceIdOf(blockType: string): string | undefined {
  return blockType.startsWith('piece_') ? blockType.slice('piece_'.length) : undefined;
}

/** A label that Blockly saves with the block, so a placeholder can show what it stands for. */
export interface LabelFieldDefinition {
  type: 'field_label_serializable';
  name: string;
  text: string;
}

/** A Blockly block definition (Blockly's word "block", not a GPS Block). */
export interface BlocklyBlockDefinition {
  type: string;
  message0: string;
  args0: (FieldDefinition | LabelFieldDefinition | { type: 'input_end_row' })[];
  colour: Colour;
  tooltip: string;
  output?: string;
  previousStatement?: null;
  nextStatement?: null;
}

export function blockDefinitions(library: Library): BlocklyBlockDefinition[] {
  return [...library.pieces.values()].map(blockDefinition);
}

function blockDefinition(piece: Piece): BlocklyBlockDefinition {
  const { id, kind, name, description, category, params } = piece.manifest;
  const fields = params.map((param) => fieldCodec(param).definition(param));
  // One parameter reads as a sentence ("Act as %1"); several get their labels, one per row
  // under the name, so the block grows taller instead of wider.
  // Arg 2i+1 is the row break before parameter i, arg 2i+2 its field.
  const message =
    params.length === 1
      ? `${name} %1`
      : name + params.map((param, i) => ` %${2 * i + 1} ${param.label} %${2 * i + 2}`).join('');
  return {
    type: pieceBlockType(id),
    message0: message,
    args0:
      params.length === 1
        ? fields
        : fields.flatMap((field) => [{ type: 'input_end_row' } as const, field]),
    ...(kind === 'condition'
      ? { output: 'Boolean' }
      : { previousStatement: null, nextStatement: null }),
    colour: categoryColour(category),
    tooltip: description,
  };
}

/** Blockly block types of the placeholders for Pieces the Library does not have (ticket 16). */
export const MISSING_ACTION_BLOCK = 'missing_piece_action';
export const MISSING_CONDITION_BLOCK = 'missing_piece_condition';

const MISSING_COLOUR = '#6b7075';
const MISSING_TOOLTIP =
  'This Piece is not in your Library. Its values are kept. Remove the block, or add the Piece and open the Block again; saving is blocked until then.';
/** The longest values line a placeholder shows. */
const MISSING_TEXT_MAX = 100;

/** The placeholders: a grey statement block and a grey Condition block, `ID` and `PARAMS` on show. */
export function missingBlockDefinitions(): BlocklyBlockDefinition[] {
  const placeholder = (condition: boolean): BlocklyBlockDefinition => ({
    type: condition ? MISSING_CONDITION_BLOCK : MISSING_ACTION_BLOCK,
    message0: 'Missing Piece %1 %2 %3',
    args0: [
      { type: 'field_label_serializable', name: 'ID', text: '' },
      { type: 'input_end_row' },
      { type: 'field_label_serializable', name: 'PARAMS', text: '' },
    ],
    ...(condition ? { output: 'Boolean' } : { previousStatement: null, nextStatement: null }),
    colour: MISSING_COLOUR,
    tooltip: MISSING_TOOLTIP,
  });
  return [placeholder(false), placeholder(true)];
}

/** The values of a missing Piece on one line: `speed = 5, note = "hi"`. */
export function missingPieceParamsText(params: Record<string, Value>): string {
  const entries = Object.entries(params).map(([name, value]) => `${name} = ${valueText(value)}`);
  if (entries.length === 0) return 'no values';
  const text = entries.join(', ');
  return text.length <= MISSING_TEXT_MAX ? text : `${text.slice(0, MISSING_TEXT_MAX - 1)}…`;
}

function valueText(value: Value): string {
  if (typeof value !== 'string')
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  const [first = '', ...more] = value.split('\n');
  return JSON.stringify(first) + (more.length > 0 ? '…' : '');
}
/** A parameter's row of the block is shown only while another field of the block has a value. */
export interface VisibilityRule {
  blockType: string;
  /** Index of the block's input row that holds the parameter (row 0 is the Piece's name). */
  row: number;
  /** The field that decides, and the value it must have, as Blockly holds it. */
  control: string;
  shownWhen: FieldValue;
}

/** The rows of Piece blocks that hide (`showWhen` in the manifest), for the editor to apply. */
export function visibilityRules(library: Library): VisibilityRule[] {
  return [...library.pieces.values()].flatMap(({ manifest }) =>
    manifest.params.flatMap((param, index): VisibilityRule[] => {
      const control = manifest.params.find((other) => other.name === param.showWhen?.param);
      if (!param.showWhen || !control) return [];
      return [
        {
          blockType: pieceBlockType(manifest.id),
          // A Piece with several parameters has the name on row 0, then one row per parameter.
          row: index + 1,
          control: control.name,
          shownWhen: fieldCodec(control).toField(param.showWhen.equals),
        },
      ];
    }),
  );
}

export interface FieldValidator {
  blockType: string;
  field: string;
  validator: (text: string) => string | null;
}

/** Validators for text fields that hold numbers (hex, Map16), to attach after defining blocks. */
export function fieldValidators(library: Library): FieldValidator[] {
  return [...library.pieces.values()].flatMap(({ manifest }) =>
    manifest.params.flatMap((param) => {
      const { validator } = fieldCodec(param);
      return validator
        ? [{ blockType: pieceBlockType(manifest.id), field: param.name, validator }]
        : [];
    }),
  );
}
