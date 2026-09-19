import { render, RESERVED_NAMES, TemplateError, type Value } from '../template';
import type { Manifest, ManifestJson, ParamSpec } from './manifest';
import type { FieldError } from '../validation';
import { checkManifestSchema } from './validate';

export type Origin = 'builtin' | 'user';

export interface Piece {
  manifest: Manifest;
  /** Folder inside its Library, e.g. `actions/act_as`. */
  dir: string;
  /** Contents of `code.asm`. */
  template: string;
  origin: Origin;
}

/** A tool routine (`routines/bc_*.asm`) or a Preset (`presets/*.asm`), keyed by file name. */
export interface LibraryFile {
  text: string;
  origin: Origin;
}

export interface Library {
  pieces: ReadonlyMap<string, Piece>;
  routines: ReadonlyMap<string, LibraryFile>;
  presets: ReadonlyMap<string, LibraryFile>;
  errors: readonly LibraryError[];
}

export interface LibraryError {
  /** Which Library the file is in. */
  origin: Origin;
  /** Path inside the Library folder, e.g. `actions/act_as/piece.json`. */
  file: string;
  /** Dotted path into the file's JSON, e.g. `params[0].type`; absent for file-level errors. */
  field?: string;
  message: string;
}

const FOLDER_KIND = { actions: 'action', conditions: 'condition' } as const;
type KindFolder = keyof typeof FOLDER_KIND;

const ROUTINE_NAME = /^bc_[a-z0-9_]+$/;
const ROUTINE_NAME_RULE =
  'routine files must be named bc_<name>.asm (lower-case letters, digits, _)';

/**
 * Builds a Library from the files of a Library folder, keyed by `/`-separated path relative to the
 * folder. Reading the folder is the caller's job (Tauri in the app, node:fs in tests). A Piece with
 * any error is left out; the others still load. Files are processed in path order, so the result
 * does not depend on the order the caller listed them in.
 */
export function loadLibrary(files: Readonly<Record<string, string>>, origin: Origin): Library {
  const pieces = new Map<string, Piece>();
  const routines = new Map<string, LibraryFile>();
  const presets = new Map<string, LibraryFile>();
  const errors: LibraryError[] = [];
  const clashes = new Map<string, Piece>();
  const paths = Object.keys(files).sort();
  for (const path of paths) {
    const text = files[path]!;
    const routine = /^routines\/([^/]+)\.asm$/.exec(path);
    if (routine) {
      if (ROUTINE_NAME.test(routine[1]!)) routines.set(routine[1]!, { text, origin });
      else errors.push({ origin, file: path, message: ROUTINE_NAME_RULE });
      continue;
    }
    const preset = /^presets\/([^/]+)\.asm$/.exec(path);
    if (preset) {
      presets.set(preset[1]!, { text, origin });
      continue;
    }
    const match = /^(actions|conditions)\/([^/]+)\/piece\.json$/.exec(path);
    if (!match) continue;
    const kindFolder = match[1] as KindFolder;
    const dir = `${kindFolder}/${match[2]}`;
    const result = loadPiece(text, files[`${dir}/code.asm`], kindFolder, match[2]!);
    if ('errors' in result) {
      errors.push(
        ...result.errors.map(({ file, ...error }) => ({
          origin,
          file: `${dir}/${file}`,
          ...error,
        })),
      );
      continue;
    }
    const { id } = result.manifest;
    const other = pieces.get(id) ?? clashes.get(id);
    if (other) {
      // An Action and a Condition with the same id: keep neither, the model could not tell them apart.
      pieces.delete(id);
      clashes.set(id, other);
      errors.push({
        origin,
        file: `${dir}/piece.json`,
        field: 'id',
        message: `'${id}' is already used by ${other.dir}`,
      });
      continue;
    }
    pieces.set(id, { ...result, dir, origin });
  }
  return { pieces, routines, presets, errors };
}

/** A LibraryError before it knows its Library; `file` is relative to the Piece folder. */
type PieceError = Omit<LibraryError, 'origin'>;

type PieceResult = { manifest: Manifest; template: string } | { errors: PieceError[] };

function loadPiece(
  manifestText: string,
  template: string | undefined,
  kindFolder: KindFolder,
  pieceFolder: string,
): PieceResult {
  let json: unknown;
  try {
    json = JSON.parse(manifestText);
  } catch (error) {
    return {
      errors: [{ file: 'piece.json', message: `is not valid JSON: ${(error as Error).message}` }],
    };
  }
  const schemaErrors = checkManifestSchema(json);
  const manifest = schemaErrors.length === 0 ? withDefaults(json as ManifestJson) : undefined;
  const fieldErrors = manifest ? checkCrossFields(manifest, kindFolder, pieceFolder) : schemaErrors;
  if (!manifest || fieldErrors.length > 0) {
    return { errors: fieldErrors.map((error) => ({ file: 'piece.json', ...error })) };
  }
  if (template === undefined) return { errors: [{ file: 'code.asm', message: 'is missing' }] };
  const templateError = checkTemplate(manifest, template);
  if (templateError) return { errors: [{ file: 'code.asm', message: templateError }] };
  return { manifest, template };
}

/** Fills in the optional fields the schema allows to be left out. */
function withDefaults(manifest: ManifestJson): Manifest {
  return { once: false, removesBlock: false, routines: [], ...manifest };
}

/** Rules the JSON Schema cannot express. */
function checkCrossFields(
  manifest: Manifest,
  kindFolder: KindFolder,
  pieceFolder: string,
): FieldError[] {
  const errors: FieldError[] = [];
  if (manifest.id !== pieceFolder) {
    errors.push({ field: 'id', message: `must match the folder name '${pieceFolder}'` });
  }
  if (manifest.kind !== FOLDER_KIND[kindFolder]) {
    errors.push({
      field: 'kind',
      message: `must be '${FOLDER_KIND[kindFolder]}' for a Piece in ${kindFolder}/`,
    });
  }
  const seen = new Map<string, number>();
  manifest.params.forEach((param, i) => {
    const field = `params[${i}]`;
    if (RESERVED_NAMES.includes(param.name)) {
      errors.push({ field: `${field}.name`, message: `'${param.name}' is reserved in templates` });
    }
    const first = seen.get(param.name);
    if (first !== undefined) {
      errors.push({
        field: `${field}.name`,
        message: `'${param.name}' is already used by params[${first}]`,
      });
    } else {
      seen.set(param.name, i);
    }
    errors.push(
      ...checkDefault(param).map((error) => ({ ...error, field: `${field}.${error.field}` })),
    );
    const listError = checkListParam(param, manifest.params);
    if (listError) errors.push({ field: `${field}.listParam`, message: listError });
    const showError = checkShowWhen(param, manifest.params);
    if (showError) errors.push({ field: `${field}.showWhen`, message: showError });
  });
  return errors;
}

/** `showWhen` names another parameter, and a value that parameter can have. */
function checkShowWhen(param: ParamSpec, params: readonly ParamSpec[]): string | undefined {
  const rule = param.showWhen;
  if (rule === undefined) return undefined;
  const control = params.find((other) => other.name === rule.param);
  if (!control || control === param) return `'${rule.param}' is not another parameter`;
  if (control.type === 'bool' && typeof rule.equals !== 'boolean') {
    return `'${rule.param}' is a bool, so this must be true or false`;
  }
  if (control.type === 'enum') {
    const values = (control.options ?? []).map((option) => option.value);
    if (!values.includes(rule.equals as number | string)) {
      return `must be one of the option values of '${rule.param}': ${values.join(', ')}`;
    }
  }
  return undefined;
}

/** `listParam` belongs to sprite and sound parameters and names a bool (sprite) or enum (sound). */
function checkListParam(param: ParamSpec, params: readonly ParamSpec[]): string | undefined {
  if (param.listParam === undefined) return undefined;
  const wanted = { sprite: 'bool', sound: 'enum' }[param.type as 'sprite' | 'sound'];
  if (wanted === undefined) return "is only for 'sprite' and 'sound' parameters";
  const target = params.find((other) => other.name === param.listParam);
  if (!target || target === param) return `'${param.listParam}' is not another parameter`;
  if (target.type !== wanted) {
    return `'${param.listParam}' must be a '${wanted}' parameter for a '${param.type}'`;
  }
  return undefined;
}

function checkDefault(param: ParamSpec): { field: 'default' | 'max'; message: string }[] {
  if (param.type === 'number') {
    const { min = 0, max = 0 } = param;
    if (max < min) return [{ field: 'max', message: `must not be below min (${min})` }];
    const value = param.default as number;
    if (value < min || value > max) {
      return [{ field: 'default', message: `must be between ${min} and ${max}` }];
    }
  }
  if (param.type === 'enum') {
    const values = (param.options ?? []).map((option) => option.value);
    if (!values.includes(param.default as number | string)) {
      return [
        { field: 'default', message: `must be one of the option values: ${values.join(', ')}` },
      ];
    }
  }
  return [];
}

/** Renders the template once with the default params; returns the error message, if any. */
function checkTemplate(manifest: Manifest, template: string): string | undefined {
  const params: Record<string, Value> = Object.fromEntries(
    manifest.params.map((param) => [param.name, param.default]),
  );
  try {
    render(template, {
      params,
      label: (name) => name,
      // Any Slot the Piece is allowed in, so that a template that tests the Slot can be checked.
      slot: manifest.slots === 'sprite' ? 'spriteTop' : 'marioTop',
      ...(manifest.kind === 'condition' && { falseLabel: 'false_target' }),
    });
    return undefined;
  } catch (error) {
    if (error instanceof TemplateError) return error.message;
    throw error;
  }
}
