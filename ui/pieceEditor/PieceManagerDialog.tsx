import { useMemo, useState } from 'react';
import type { Library, Piece } from '../../core/library';
import { Modal } from '../Modal';
import {
  deleteCustomPiece,
  exportPiecesZip,
  importPiecesZip,
  openUserPiecesFolder,
  saveCustomPiece,
  userLibrarySupported,
} from '../userLibrary';
import { PieceEditorForm } from './PieceEditorForm';
import { PiecesLocationPicker } from './PiecesLocationPicker';
import { initialFormData, manifestToFormData, type PieceFormData } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  library: Library;
  userLibrary: Library | null;
  onLibraryChanged: () => Promise<void>;
  defaultAuthor?: string;
}

export function PieceManagerDialog({
  open,
  onClose,
  library: _library,
  userLibrary,
  onLibraryChanged,
  defaultAuthor = '',
}: Props) {
  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [formData, setFormData] = useState<PieceFormData>(() =>
    initialFormData('action', defaultAuthor),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // User's custom pieces
  const userPieces = useMemo<Piece[]>(() => {
    if (!userLibrary) return [];
    return Array.from(userLibrary.pieces.values()).filter((p) => p.origin === 'user');
  }, [userLibrary]);

  const filteredPieces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return userPieces;
    return userPieces.filter(
      (p) =>
        p.manifest.name.toLowerCase().includes(q) ||
        p.manifest.id.toLowerCase().includes(q) ||
        p.manifest.category.toLowerCase().includes(q) ||
        p.manifest.author.toLowerCase().includes(q),
    );
  }, [userPieces, searchQuery]);

  const startNewPiece = (kind: 'action' | 'condition' = 'action') => {
    setEditingPiece(null);
    setFormData(initialFormData(kind, defaultAuthor));
    setMode('editor');
    setStatus(null);
  };

  const startEditPiece = (piece: Piece) => {
    setEditingPiece(piece);
    setFormData(manifestToFormData(piece.manifest, piece.template));
    setMode('editor');
    setStatus(null);
  };

  const handleDelete = async (piece: Piece) => {
    const confirmed = window.confirm(
      `Delete custom piece "${piece.manifest.name}" (${piece.manifest.id})? This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const kindFolder = piece.manifest.kind === 'action' ? 'actions' : 'conditions';
      await deleteCustomPiece(kindFolder, piece.manifest.id);
      await onLibraryChanged();
      setStatus({ kind: 'success', text: `Deleted piece "${piece.manifest.name}".` });
    } catch (e) {
      setStatus({ kind: 'error', text: `Failed to delete piece: ${String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const handleExportSingle = async (piece: Piece) => {
    try {
      const exported = await exportPiecesZip([piece], `${piece.manifest.id}.zip`);
      if (exported) {
        setStatus({ kind: 'success', text: `Exported "${piece.manifest.name}" to zip archive.` });
      }
    } catch (e) {
      setStatus({ kind: 'error', text: `Export failed: ${String(e)}` });
    }
  };

  const handleExportAll = async () => {
    if (userPieces.length === 0) return;
    try {
      const exported = await exportPiecesZip(userPieces, 'custom_pieces.zip');
      if (exported) {
        setStatus({
          kind: 'success',
          text: `Exported ${userPieces.length} custom piece(s) to zip archive.`,
        });
      }
    } catch (e) {
      setStatus({ kind: 'error', text: `Export failed: ${String(e)}` });
    }
  };

  const handleImportZip = async () => {
    setBusy(true);
    try {
      const result = await importPiecesZip();
      if (result) {
        await onLibraryChanged();
        setStatus({
          kind: 'success',
          text: `Successfully imported ${result.importedCount} piece(s) (${result.ids.join(', ')}).`,
        });
      }
    } catch (e) {
      setStatus({ kind: 'error', text: `Import failed: ${String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const handleSavePiece = async (manifestJson: string, template: string) => {
    const kindFolder = formData.kind === 'action' ? 'actions' : 'conditions';
    const oldDir = editingPiece ? editingPiece.dir : undefined;
    await saveCustomPiece(kindFolder, formData.id.trim(), manifestJson, template, oldDir);
    await onLibraryChanged();
    setMode('list');
    setStatus({
      kind: 'success',
      text: `Saved custom piece "${formData.name}". It is now ready in Blockly!`,
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setMode('list');
        onClose();
      }}
      titleId="piece-manager-title"
    >
      <div className="modal-body piece-manager-modal">
        {mode === 'editor' ? (
          <PieceEditorForm
            formData={formData}
            onChange={setFormData}
            onSave={handleSavePiece}
            onCancel={() => setMode('list')}
            isNew={editingPiece === null}
          />
        ) : (
          <>
            <div className="manager-header">
              <div>
                <h2 id="piece-manager-title">Custom Pieces</h2>
                <p className="hint">
                  Create, edit, import and export your own Actions and Conditions. Custom pieces are
                  instantly available in Blockly.
                </p>
              </div>
              <div className="manager-header-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => startNewPiece('action')}
                  disabled={!userLibrarySupported || busy}
                >
                  + New Piece
                </button>
                <button
                  type="button"
                  onClick={handleImportZip}
                  disabled={!userLibrarySupported || busy}
                  title="Import pieces from a .zip archive"
                >
                  Import (.zip)
                </button>
                <button
                  type="button"
                  onClick={handleExportAll}
                  disabled={!userLibrarySupported || userPieces.length === 0 || busy}
                  title="Export all custom pieces to a .zip archive"
                >
                  Export All ({userPieces.length})
                </button>
                <button
                  type="button"
                  onClick={openUserPiecesFolder}
                  disabled={!userLibrarySupported || busy}
                  title="Open user pieces folder in Windows Explorer"
                >
                  Open Folder
                </button>
              </div>
            </div>

            {userLibrarySupported && (
              <PiecesLocationPicker
                disabled={busy}
                onChanged={onLibraryChanged}
                onStatus={setStatus}
              />
            )}

            {status && <p className={`notice ${status.kind}`}>{status.text}</p>}

            {userPieces.length > 0 && (
              <div className="manager-search-bar">
                <input
                  type="search"
                  placeholder="Search custom pieces…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="hint">
                  Showing {filteredPieces.length} of {userPieces.length} piece(s)
                </span>
              </div>
            )}

            <div className="pieces-list-container">
              {userPieces.length === 0 ? (
                <div className="empty-pieces-state">
                  <div className="empty-pieces-icon">🧩</div>
                  <h3>No custom pieces yet</h3>
                  <p className="hint">
                    You can create custom Actions (to do something when Mario or sprites hit the
                    block) or Conditions (for if-checks), or import a .zip package from other
                    creators.
                  </p>
                  <div className="empty-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => startNewPiece('action')}
                      disabled={!userLibrarySupported}
                    >
                      + Create Action Piece
                    </button>
                    <button
                      type="button"
                      onClick={() => startNewPiece('condition')}
                      disabled={!userLibrarySupported}
                    >
                      + Create Condition Piece
                    </button>
                  </div>
                </div>
              ) : filteredPieces.length === 0 ? (
                <p className="hint">No pieces match "{searchQuery}".</p>
              ) : (
                <div className="piece-cards-grid">
                  {filteredPieces.map((piece) => (
                    <div key={piece.manifest.id} className="piece-card">
                      <div className="piece-card-header">
                        <div className="piece-card-titles">
                          <div className="piece-card-badges">
                            <span className={`kind-badge ${piece.manifest.kind}`}>
                              {piece.manifest.kind}
                            </span>
                            <span className="cat-badge">{piece.manifest.category}</span>
                            <span className="slots-badge">{piece.manifest.slots}</span>
                          </div>
                          <strong>{piece.manifest.name}</strong>
                          <span className="piece-id-code">
                            <code>{piece.manifest.id}</code>
                          </span>
                        </div>
                      </div>

                      {piece.manifest.description ? (
                        <p className="piece-desc">{piece.manifest.description}</p>
                      ) : (
                        <p className="piece-desc muted">No description provided.</p>
                      )}

                      <div className="piece-card-footer">
                        <div className="piece-meta">
                          <span className="piece-author">By {piece.manifest.author}</span>
                          <span className="piece-params">
                            {piece.manifest.params.length} parameter
                            {piece.manifest.params.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="piece-card-buttons">
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => startEditPiece(piece)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-small"
                            title="Export piece as .zip"
                            onClick={() => handleExportSingle(piece)}
                          >
                            Export
                          </button>
                          <button
                            type="button"
                            className="btn-danger-small"
                            title="Delete piece"
                            onClick={() => handleDelete(piece)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
