import type { MultiSelect } from './multiselect';

interface Props {
  /** Number of selected blocks. */
  count: number;
  /** Runs an action on the workspace's multi-selection (once it exists). */
  run: (action: (selection: MultiSelect) => void) => void;
}

/** What Shift does while nothing is selected; the actions on the selection once there is one. */
export function SelectionBar({ count, run }: Props) {
  if (count === 0) {
    return (
      <p className="selection-hint">Shift+click or Shift+drag selects several blocks; Ctrl+A all</p>
    );
  }
  // Each button hands the keyboard back to the workspace, so Ctrl+V works right after Copy.
  const action = (label: string, act: (selection: MultiSelect) => void) => (
    <button
      type="button"
      onClick={() =>
        run((selection) => {
          act(selection);
          selection.focus();
        })
      }
    >
      {label}
    </button>
  );
  return (
    <div className="selection-bar" role="toolbar" aria-label="Selected blocks">
      <span className="selection-count">{count === 1 ? '1 block' : `${count} blocks`}</span>
      {action('Copy', (s) => s.copy())}
      {action('Cut', (s) => s.cut())}
      {action('Duplicate', (s) => s.duplicate())}
      {action('Delete', (s) => s.deleteSelected())}
      {action('Clear', (s) => s.clear())}
    </div>
  );
}
