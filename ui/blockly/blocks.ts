// Blockly block definitions (JSON) built from Piece manifests. Pure data: no Blockly import, so
// it can be tested without a DOM. BlocklyEditor hands them to Blockly.

import type { Library, Piece } from '../../core/library';
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

/** A Blockly block definition (Blockly's word "block", not a GPS Block). */
export interface BlocklyBlockDefinition {
  type: string;
  message0: string;
  args0: (FieldDefinition | { type: 'input_end_row' })[];
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
