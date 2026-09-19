import type { CheckProblem } from '../core/assemble';
import type { SlotId } from '../core/model';
import { groupName, SLOT_LABELS } from './slots';

interface Props {
  problems: readonly CheckProblem[];
  /** Name of the Piece an error comes from, when it comes from one. */
  pieceName: (problem: CheckProblem) => string | undefined;
  onSelectSlot: (slot: SlotId) => void;
}

/** The result of the last Asar check: each error with its Slot, Piece and line. */
export function CheckResults({ problems, pieceName, onSelectSlot }: Props) {
  return (
    <ul className="check-results" aria-label="Asar check">
      {problems.length === 0 && <li className="check-ok">Asar: no errors</li>}
      {problems.map((problem, i) => {
        const { origin, line } = problem;
        const piece = pieceName(problem);
        return (
          <li key={i} className="check-error">
            {origin && (
              <button type="button" onClick={() => onSelectSlot(origin.slot)}>
                {groupName(origin.slot)} · {SLOT_LABELS[origin.slot]}
              </button>
            )}
            {piece && <span className="piece">{piece}</span>}
            {line !== undefined && <span className="line">line {line}</span>}
            <span>{problem.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
