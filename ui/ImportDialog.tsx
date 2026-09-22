import { useState } from 'react';
import type { Library } from '../core/library';
import type { BlockModel } from '../core/model';
import { Modal } from './Modal';
import { parseBlockText } from './importBlock';

interface Props {
  open: boolean;
  onClose: () => void;
  library: Library;
  onImport: (model: BlockModel) => void;
}

export function ImportDialog({ open, onClose, library, onImport }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    setError(null);
    const result = parseBlockText(text, library);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onImport(result.model);
    onClose();
  };

  const handlePasteClipboard = async () => {
    try {
      const clipboard = await navigator.clipboard.readText();
      if (clipboard) {
        setText(clipboard);
        setError(null);
      }
    } catch {
      // Clipboard access might be denied in some browsers; user can paste manually.
    }
  };

  return (
    <Modal open={open} onClose={onClose} titleId="import-title">
      <div className="modal-body modal-wide">
        <h2 id="import-title">Import Block from ASM / Text</h2>
        <p className="hint">
          Paste the ASM code of a BlockCreator block (with the <code>;bc-model</code> header) or raw block JSON below.
        </p>

        <div className="import-controls">
          <button type="button" className="btn-secondary" onClick={handlePasteClipboard} title="Paste from clipboard">
            Paste from Clipboard
          </button>
        </div>

        <textarea
          className="import-textarea"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder=";bc-format 1&#10;;bc-model {...}&#10;;bc-checksum ...&#10;&#10;db $42&#10;..."
          rows={12}
          autoFocus
          spellCheck={false}
        />

        {error && <div className="import-error-banner">{error}</div>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleImport}
            disabled={!text.trim()}
          >
            Import Block
          </button>
        </div>
      </div>
    </Modal>
  );
}
