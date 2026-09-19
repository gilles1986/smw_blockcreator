import { Modal } from './Modal';
import type { Preset } from './presets';

interface Props {
  open: boolean;
  onClose: () => void;
  presets: readonly Preset[];
  /** A Preset was chosen; the dialog is closed already. */
  onPick: (preset: Preset) => void;
}

/** The ready-made Blocks of the Library: pick one to start from a copy of it. */
export function PresetDialog({ open, onClose, presets, onPick }: Props) {
  return (
    <Modal open={open} onClose={onClose} titleId="presets-title">
      <div className="modal-body">
        <h2 id="presets-title">New from preset</h2>
        {presets.length === 0 && <p className="hint">This Library has no presets.</p>}
        <div className="preset-list">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset"
              onClick={() => {
                onClose();
                onPick(preset);
              }}
            >
              <strong>{preset.name}</strong>
              <span className="hint">{preset.description}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
