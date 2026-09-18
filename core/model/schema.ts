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
    topCornerFollowsTop: { type: 'boolean' },
  },
  definitions: {
    statements: { type: 'array', items: { $ref: '#/definitions/statement' } },
    statement: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: { enum: ['action', 'if'] },
        piece: pieceRef,
        branches: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['condition', 'body'],
            properties: {
              condition: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'piece'],
                properties: { type: { enum: ['condition'] }, piece: pieceRef },
              },
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
            not: { anyOf: [{ required: ['branches'] }, { required: ['else'] }] },
          },
        },
        {
          if: { properties: { type: { const: 'if' } } },
          then: { required: ['branches'], not: { required: ['piece'] } },
        },
      ],
    },
  },
};

/** Checks untrusted JSON against the Block model schema. */
export const checkModel: (json: unknown) => FieldError[] = schemaChecker(modelSchema);
