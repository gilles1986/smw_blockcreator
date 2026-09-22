import { parse } from '../core/header';
import type { Library } from '../core/library';
import {
  checkPieces,
  upgradePieces,
  type BlockModel,
} from '../core/model';
import { checkModel } from '../core/model/schema';
import { describeFieldError } from '../core/validation';

export function parseBlockText(
  text: string,
  library: Library,
): { ok: true; model: BlockModel } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, message: 'Please paste ASM code or block JSON.' };
  }

  // 1. Raw JSON support:
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const json = JSON.parse(trimmed);
      const [problem] = checkModel(json);
      if (problem) {
        return { ok: false, message: `Invalid block JSON: ${describeFieldError(problem)}` };
      }
      const { model } = upgradePieces(json as BlockModel, library);
      const problems = checkPieces(model, library, { allowMissing: true });
      if (problems.length > 0) {
        return { ok: false, message: `Block has problems:\n${problems.join('\n')}` };
      }
      return { ok: true, model };
    } catch (e) {
      return { ok: false, message: `Invalid JSON: ${(e as Error).message}` };
    }
  }

  // 2. Full or partial ASM text with ;bc-format:
  const bcIdx = text.indexOf(';bc-format');
  const asmText = bcIdx >= 0 ? text.slice(bcIdx) : text;
  const result = parse(asmText);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  const { model } = upgradePieces(result.model, library);
  const problems = checkPieces(model, library, { allowMissing: true });
  if (problems.length > 0) {
    return { ok: false, message: `Block has problems:\n${problems.join('\n')}` };
  }
  return { ok: true, model };
}
