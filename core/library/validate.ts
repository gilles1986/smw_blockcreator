import { schemaChecker, type FieldError } from '../validation';
import schema from './piece.schema.json';

/** Checks a parsed `piece.json` against the manifest schema. */
export const checkManifestSchema: (json: unknown) => FieldError[] = schemaChecker(schema);
