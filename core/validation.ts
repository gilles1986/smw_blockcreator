// JSON Schema checks with readable errors (field path + plain message), shared by the Piece
// manifest and the Block model.

import { Ajv, type ErrorObject, type SchemaObject } from 'ajv';

export interface FieldError {
  /** Dotted path into the JSON, e.g. `params[0].type`; absent for the document as a whole. */
  field?: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true });

/** Compiles `schema` once; the returned check lists every problem it finds (none if valid). */
export function schemaChecker(schema: SchemaObject): (json: unknown) => FieldError[] {
  const validate = ajv.compile(schema);
  return (json) => {
    if (validate(json)) return [];
    // `if` errors only say "must match then"; the `then` errors say what is actually wrong.
    return (validate.errors ?? []).filter((error) => error.keyword !== 'if').map(toFieldError);
  };
}

/** "field message", or just the message for the document as a whole. */
export function describeFieldError(error: FieldError): string {
  return error.field ? `${error.field} ${error.message}` : error.message;
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
