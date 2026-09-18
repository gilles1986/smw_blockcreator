// Blockly block definitions (JSON) built from Piece manifests. Pure data: no Blockly import, so
// it can be tested without a DOM. BlocklyEditor hands them to Blockly.

import type { Library, Piece } from '../../core/library';
import { categoryColour, type Colour } from './categories';
import { fieldCodec, type FieldDefinition } from './fields';

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
  args0: FieldDefinition[];
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
  // One parameter reads as a sentence ("Act as %1"); several get their labels.
  const message =
    params.length === 1
      ? `${name} %1`
      : [name, ...params.map((param, i) => `${param.label} %${i + 1}`)].join(' ');
  return {
    type: pieceBlockType(id),
    message0: message,
    args0: params.map((param) => fieldCodec(param).definition(param)),
    ...(kind === 'condition'
      ? { output: 'Boolean' }
      : { previousStatement: null, nextStatement: null }),
    colour: categoryColour(category),
    tooltip: description,
  };
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
