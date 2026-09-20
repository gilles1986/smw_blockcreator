import { useMemo, useState } from 'react';
import { loadPiece, type PieceError } from '../../core/library';
import { ParamEditor } from './ParamEditor';
import {
  BUILTIN_CATEGORIES,
  formDataToManifest,
  frequencyFlags,
  frequencyOf,
  type Frequency,
  type PieceFormData,
} from './types';

/** The choices for how often an Action runs, in the order they are offered. */
const FREQUENCIES: { value: Frequency; title: string; help: string }[] = [
  {
    value: 'every',
    title: 'Every frame while the block is touched',
    help: 'For things that should keep going, like pushing Mario or holding a sprite.',
  },
  {
    value: 'once',
    title: 'Only once',
    help: 'For a sound, a coin, a spawned sprite. Because the code runs again every frame, BlockCreator warns unless the same branch also removes or changes the block.',
  },
  {
    value: 'removes',
    title: 'Removes or changes the block',
    help: 'This Action erases the block or turns it into another one (like Erase block, Shatter, Change to tile). It makes “Only once” Actions next to it safe.',
  },
];

interface Props {
  formData: PieceFormData;
  onChange: (data: PieceFormData) => void;
  onSave: (manifestJson: string, template: string) => Promise<void>;
  onCancel: () => void;
  isNew: boolean;
}

export function PieceEditorForm({ formData, onChange, onSave, onCancel, isNew }: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (patch: Partial<PieceFormData>) => onChange({ ...formData, ...patch });

  // Live validation
  const validation = useMemo<{ valid: boolean; errors: PieceError[]; manifestJson: string }>(() => {
    const manifest = formDataToManifest(formData);
    const manifestJson = JSON.stringify(manifest, null, 2);
    const kindFolder = formData.kind === 'action' ? 'actions' : 'conditions';
    const result = loadPiece(manifestJson, formData.template, kindFolder, formData.id.trim());
    if ('errors' in result) {
      return { valid: false, errors: result.errors, manifestJson };
    }
    return { valid: true, errors: [], manifestJson };
  }, [formData]);

  const insertSnippet = (snippet: string) => {
    set({ template: `${formData.template.trimEnd()}\n${snippet}\n` });
  };

  const handleSave = async () => {
    if (!validation.valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(validation.manifestJson, formData.template);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="piece-editor-form">
      <div className="editor-top-bar">
        <h3>{isNew ? 'Create New Piece' : `Edit Piece: ${formData.name}`}</h3>
        <div className="editor-top-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !validation.valid}
          >
            {saving ? 'Saving…' : 'Save Piece'}
          </button>
        </div>
      </div>

      {saveError && <p className="notice error">{saveError}</p>}

      <div className="form-sections-grid">
        {/* Left Column: Metadata & Parameters */}
        <div className="form-column">
          <div className="form-card">
            <h4>Basic Information</h4>

            <div className="kind-toggle-row">
              <label className="radio-btn">
                <input
                  type="radio"
                  name="piece-kind"
                  value="action"
                  checked={formData.kind === 'action'}
                  onChange={() => {
                    set({
                      kind: 'action',
                      category: formData.category === 'conditions' ? 'physics' : formData.category,
                      id: formData.id.startsWith('c_') ? formData.id.slice(2) : formData.id,
                    });
                  }}
                />
                <span>Action</span>
              </label>
              <label className="radio-btn">
                <input
                  type="radio"
                  name="piece-kind"
                  value="condition"
                  checked={formData.kind === 'condition'}
                  onChange={() => {
                    set({
                      kind: 'condition',
                      category: 'conditions',
                      id: formData.id.startsWith('c_') ? formData.id : `c_${formData.id}`,
                    });
                  }}
                />
                <span>Condition (If / Else)</span>
              </label>
            </div>

            <div className="form-grid-2">
              <label>
                ID (lowercase & underscores)
                <input
                  value={formData.id}
                  placeholder="e.g. give_coins, c_is_small"
                  onChange={(e) =>
                    set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
                  }
                />
              </label>
              <label>
                Display Name
                <input
                  value={formData.name}
                  placeholder="e.g. Give 5 Coins"
                  onChange={(e) => set({ name: e.target.value })}
                />
              </label>
            </div>

            <div className="form-grid-2">
              <label>
                Category
                <select
                  value={formData.category}
                  onChange={(e) => set({ category: e.target.value })}
                >
                  {BUILTIN_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                  <option value="custom">Custom category…</option>
                </select>
              </label>
              {formData.category === 'custom' ? (
                <label>
                  Custom Category Name
                  <input
                    value={formData.customCategory}
                    placeholder="e.g. powerups"
                    onChange={(e) => set({ customCategory: e.target.value })}
                  />
                </label>
              ) : (
                <label>
                  Applicable Slots
                  <select
                    value={formData.slots}
                    onChange={(e) => set({ slots: e.target.value as 'any' | 'mario' | 'sprite' })}
                  >
                    <option value="any">Any Slot (Mario & Sprites)</option>
                    <option value="mario">Mario Slots only</option>
                    <option value="sprite">Sprite Slots only</option>
                  </select>
                </label>
              )}
            </div>

            {formData.category === 'custom' && (
              <label>
                Applicable Slots
                <select
                  value={formData.slots}
                  onChange={(e) => set({ slots: e.target.value as 'any' | 'mario' | 'sprite' })}
                >
                  <option value="any">Any Slot (Mario & Sprites)</option>
                  <option value="mario">Mario Slots only</option>
                  <option value="sprite">Sprite Slots only</option>
                </select>
              </label>
            )}

            <label>
              Description / Tooltip
              <textarea
                rows={2}
                value={formData.description}
                placeholder="Explains what the piece does when hovered in Blockly"
                onChange={(e) => set({ description: e.target.value })}
              />
            </label>

            <div className="form-grid-2">
              <label>
                Author
                <input
                  value={formData.author}
                  placeholder="Your name"
                  onChange={(e) => set({ author: e.target.value })}
                />
              </label>
              <label>
                Credits (optional)
                <input
                  value={formData.credits}
                  placeholder="Attribution / source"
                  onChange={(e) => set({ credits: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="form-card">
            <h4>Behavior</h4>

            {formData.kind === 'action' && (
              <fieldset className="flags-group">
                <legend className="flags-title">How often should this Action run?</legend>
                <span className="hint">
                  A Slot's code runs again every frame the block is touched, about 60 times a
                  second.
                </span>
                <div className="choice-list">
                  {FREQUENCIES.map((choice) => (
                    <label key={choice.value} className="choice">
                      <input
                        type="radio"
                        name="piece-frequency"
                        checked={frequencyOf(formData) === choice.value}
                        onChange={() => set(frequencyFlags(choice.value))}
                      />
                      <span>
                        <strong>{choice.title}</strong>
                        <span className="choice-help">{choice.help}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="flags-group">
              <legend className="flags-title">Does your code change X or Y?</legend>
              <span className="hint">
                Most Pieces only use A and need nothing here. If your code changes X or Y (LDX, LDY,
                TAX, TAY, INX, INY, DEX, DEY, or a routine that does), tick it and BlockCreator puts
                the old value back afterwards. Otherwise the Pieces around yours get a wrong value.
              </span>
              <div className="choice-list">
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={formData.clobbersX}
                    onChange={(e) => set({ clobbersX: e.target.checked })}
                  />
                  <span>
                    <strong>X</strong>
                    <span className="choice-help">
                      The sprite's slot number. Only restored in sprite Slots.
                    </span>
                  </span>
                </label>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={formData.clobbersY}
                    onChange={(e) => set({ clobbersY: e.target.checked })}
                  />
                  <span>
                    <strong>Y</strong>
                    <span className="choice-help">
                      The Act As high byte, restored in every Slot. Leave it off if your Piece sets
                      Y on purpose.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <label>
              <span>
                Routines needed (optional, comma-separated, e.g. <code>bc_something</code>)
              </span>
              <input
                value={formData.routines}
                placeholder="bc_..."
                onChange={(e) => set({ routines: e.target.value })}
              />
            </label>
          </div>

          <div className="form-card">
            <ParamEditor params={formData.params} onChange={(params) => set({ params })} />
          </div>
        </div>

        {/* Right Column: ASM Template Editor & Snippets */}
        <div className="form-column">
          <div className="form-card template-card">
            <div className="template-header">
              <h4>ASM Code Template (code.asm)</h4>
              <span className="hint">65816 Assembly with Mustache tags</span>
            </div>

            <div className="snippet-bar">
              <span className="snippet-title">Insert Tag:</span>
              {formData.kind === 'condition' && (
                <button
                  type="button"
                  className="snippet-chip highlight"
                  title="Jump to false label when condition fails"
                  onClick={() => insertSnippet('BEQ {{false}}')}
                >
                  BEQ &#123;&#123;false&#125;&#125;
                </button>
              )}
              {formData.params.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="snippet-chip"
                  title={`Insert ${p.name} parameter`}
                  onClick={() =>
                    insertSnippet(
                      p.type === 'bool'
                        ? `{{#if ${p.name}}}\n  ; code when true\n{{/if}}`
                        : p.type === 'map16'
                          ? `{{hex ${p.name} 4}}`
                          : `{{${p.name}}}`,
                    )
                  }
                >
                  &#123;&#123;{p.name}&#125;&#125;
                </button>
              ))}
              <button
                type="button"
                className="snippet-chip"
                title="SA-1 RAM mirror address"
                onClick={() => insertSnippet('|!addr')}
              >
                |!addr
              </button>
              <button
                type="button"
                className="snippet-chip"
                title="Unique label generated by BlockCreator"
                onClick={() => insertSnippet('{{label "loop"}}:\n  ; code\n  BNE {{label "loop"}}')}
              >
                &#123;&#123;label&#125;&#125;
              </button>
            </div>

            <textarea
              className="asm-template-textarea"
              rows={20}
              value={formData.template}
              spellCheck={false}
              onChange={(e) => set({ template: e.target.value })}
            />

            {/* Validation feedback */}
            <div className="validation-box">
              {validation.valid ? (
                <div className="validation-ok">
                  <span className="ok-icon">✓</span>
                  <strong>Valid Piece:</strong> Ready to save and use in Blockly.
                </div>
              ) : (
                <div className="validation-err">
                  <strong>Issues found ({validation.errors.length}):</strong>
                  <ul>
                    {validation.errors.map((err, i) => (
                      <li key={i}>
                        <code>{err.file}</code> {err.field ? `(${err.field}): ` : ': '}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
