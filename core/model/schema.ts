// JSON Schema of the Block model, for models read from files (untrusted). Built in code so the
// Slot list comes from SLOT_IDS.

import { schemaChecker, type FieldError } from '../validation';
import { SLOT_IDS } from './index';

const pieceRef = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'version', 'params'],
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
    version: { type: 'integer', minimum: 1 },
    params: { type: 'object' },
  },
};

const modelSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['properties', 'slots'],
  properties: {
    properties: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'author', 'defaultActAs'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        author: { type: 'string' },
        defaultActAs: { type: 'integer', minimum: 0, maximum: 0xffff },
      },
    },
    slots: {
      type: 'object',
      propertyNames: { enum: [...SLOT_IDS] },
      additionalProperties: { $ref: '#/definitions/statements' },
    },
    slotLinks: {
      type: 'object',
      propertyNames: { enum: [...SLOT_IDS] },
      additionalProperties: { enum: [...SLOT_IDS] },
    },
    topCornerFollowsTop: { type: 'boolean' },
  },
  definitions: {
    // A Condition Piece, or Conditions combined with AND / OR / NOT.
    condition: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: { enum: ['condition', 'and', 'or', 'not'] },
        piece: pieceRef,
        left: { $ref: '#/definitions/condition' },
        right: { $ref: '#/definitions/condition' },
        condition: { $ref: '#/definitions/condition' },
      },
      allOf: [
        {
          if: { properties: { type: { const: 'condition' } } },
          then: {
            required: ['piece'],
            not: {
              anyOf: [{ required: ['left'] }, { required: ['right'] }, { required: ['condition'] }],
            },
          },
        },
        {
          if: { properties: { type: { enum: ['and', 'or'] } } },
          then: {
            required: ['left', 'right'],
            not: { anyOf: [{ required: ['piece'] }, { required: ['condition'] }] },
          },
        },
        {
          if: { properties: { type: { const: 'not' } } },
          then: {
            required: ['condition'],
            not: {
              anyOf: [{ required: ['piece'] }, { required: ['left'] }, { required: ['right'] }],
            },
          },
        },
      ],
    },
    statements: { type: 'array', items: { $ref: '#/definitions/statement' } },
    statement: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: { enum: ['action', 'if', 'atNeighbour'] },
        piece: pieceRef,
        direction: { enum: ['above', 'below', 'left', 'right'] },
        distance: { type: 'integer', minimum: 1 },
        body: { $ref: '#/definitions/statements' },
        branches: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['condition', 'body'],
            properties: {
              condition: { $ref: '#/definitions/condition' },
              body: { $ref: '#/definitions/statements' },
            },
          },
        },
        else: { $ref: '#/definitions/statements' },
      },
      allOf: [
        {
          if: { properties: { type: { const: 'action' } } },
          then: {
            required: ['piece'],
            not: {
              anyOf: [
                { required: ['branches'] },
                { required: ['else'] },
                { required: ['direction'] },
                { required: ['distance'] },
                { required: ['body'] },
              ],
            },
          },
        },
        {
          if: { properties: { type: { const: 'if' } } },
          then: {
            required: ['branches'],
            not: {
              anyOf: [
                { required: ['piece'] },
                { required: ['direction'] },
                { required: ['distance'] },
              ],
            },
          },
        },
        {
          if: { properties: { type: { const: 'atNeighbour' } } },
          then: {
            required: ['direction', 'distance', 'body'],
            not: {
              anyOf: [{ required: ['piece'] }, { required: ['branches'] }, { required: ['else'] }],
            },
          },
        },
      ],
    },
  },
};

/** Checks untrusted JSON against the Block model schema. */
export const checkModel: (json: unknown) => FieldError[] = schemaChecker(modelSchema);
