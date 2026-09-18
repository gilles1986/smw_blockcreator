import { Ajv, type ErrorObject } from 'ajv';
import schema from './piece.schema.json';
import type { ManifestJson } from './manifest';

export interface FieldError {
  /** Dotted path into the manifest, e.g. `params[0].type`; absent for the manifest as a whole. */
  field?: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile<ManifestJson>(schema);

/** Checks a parsed `piece.json` against the manifest schema. */
export function checkManifestSchema(json: unknown): FieldError[] {
  if (validateSchema(json)) return [];
  return (validateSchema.errors ?? []).filter((error) => error.keyword !== 'if').map(toFieldError);
}

function toFieldError(error: ErrorObject): FieldError {
  const path = error.instancePath
    .split('/')
    .slice(1)
    .map((part) => (/^\d+$/.test(part) ? `[${part}]` : `.${part}`))
    .join('')
    .replace(/^\./, '');
  const childField = (child: string) => (path ? `${path}.${child}` : child);
  const at = path ? { field: path } : {};
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case 'required':
      return { field: childField(String(params.missingProperty)), message: 'is required' };
    case 'additionalProperties':
      return {
        field: childField(String(params.additionalProperty)),
        message: 'is not a known field',
      };
    case 'enum':
      return {
        ...at,
        message: `must be one of: ${(params.allowedValues as unknown[]).join(', ')}`,
      };
    case 'type':
      return { ...at, message: `must be ${typeName(String(params.type))}` };
    default:
      return { ...at, message: error.message ?? 'is invalid' };
  }
}

function typeName(type: string): string {
  const names: Record<string, string> = {
    integer: 'an integer',
    number: 'a number',
    string: 'text',
    boolean: 'true or false',
    array: 'a list',
    object: 'an object',
  };
  return type
    .split(',')
    .map((t) => names[t] ?? t)
    .join(' or ');
}
