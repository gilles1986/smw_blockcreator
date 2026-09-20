import { useState } from 'react';
import type { EnumOption, ParamSpec, ParamType } from '../../core/library';

interface Props {
  params: ParamSpec[];
  onChange: (params: ParamSpec[]) => void;
}

const PARAM_TYPES: { type: ParamType; label: string }[] = [
  { type: 'number', label: 'Number (range & format)' },
  { type: 'enum', label: 'Dropdown Choices (Enum)' },
  { type: 'bool', label: 'Checkbox Switch (Boolean)' },
  { type: 'map16', label: 'Map16 Tile' },
  { type: 'sprite', label: 'Sprite Number' },
  { type: 'sound', label: 'Sound Effect' },
  { type: 'text', label: 'Single-line Text' },
  { type: 'multiline', label: 'Multi-line Code / Text' },
];

function defaultForType(type: ParamType): ParamSpec['default'] {
  switch (type) {
    case 'number':
      return 0;
    case 'bool':
      return true;
    case 'enum':
      return 'option_1';
    case 'map16':
      return 0x130;
    case 'sprite':
    case 'sound':
      return 0;
    case 'text':
    case 'multiline':
      return '';
  }
}

export function ParamEditor({ params, onChange }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const addParam = () => {
    const nextIndex = params.length + 1;
    const newParam: ParamSpec = {
      name: `param_${nextIndex}`,
      label: `Parameter ${nextIndex}`,
      type: 'number',
      default: 0,
      min: 0,
      max: 255,
      format: 'dec',
    };
    onChange([...params, newParam]);
    setEditingIndex(params.length);
  };

  const updateParam = (index: number, patch: Partial<ParamSpec>) => {
    const updated = [...params];
    const current = updated[index];
    if (!current) return;
    updated[index] = { ...current, ...patch } as ParamSpec;
    onChange(updated);
  };

  const removeParam = (index: number) => {
    onChange(params.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const moveParam = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= params.length) return;
    const copy = [...params];
    const item = copy[index]!;
    copy[index] = copy[target]!;
    copy[target] = item;
    onChange(copy);
    if (editingIndex === index) setEditingIndex(target);
  };

  return (
    <div className="param-editor">
      <div className="param-header-row">
        <strong>Parameters ({params.length})</strong>
        <button type="button" className="btn-small" onClick={addParam}>
          + Add Parameter
        </button>
      </div>
      {params.length === 0 ? (
        <p className="hint">
          No parameters defined. The piece will have a fixed behavior without inputs.
        </p>
      ) : (
        <div className="param-list">
          {params.map((param, index) => {
            const isEditing = editingIndex === index;
            return (
              <div key={index} className={`param-card ${isEditing ? 'active' : ''}`}>
                <div
                  className="param-summary-row"
                  onClick={() => setEditingIndex(isEditing ? null : index)}
                >
                  <span className="param-badge">{param.type}</span>
                  <span className="param-name">
                    <code>{`{{${param.name}}}`}</code>
                  </span>
                  <span className="param-label">{param.label}</span>
                  <div className="param-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="icon-btn-small"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => moveParam(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn-small"
                      title="Move down"
                      disabled={index === params.length - 1}
                      onClick={() => moveParam(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-danger-small"
                      title="Delete parameter"
                      onClick={() => removeParam(index)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="param-details">
                    <div className="form-grid-2">
                      <label>
                        Identifier name (in template)
                        <input
                          value={param.name}
                          placeholder="e.g. count, tile_id"
                          onChange={(e) =>
                            updateParam(index, {
                              name: e.target.value.replace(/[^A-Za-z0-9_]/g, '_'),
                            })
                          }
                        />
                      </label>
                      <label>
                        Block Label
                        <input
                          value={param.label}
                          placeholder="Label shown on block"
                          onChange={(e) => updateParam(index, { label: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="form-grid-2">
                      <label>
                        Input Type
                        <select
                          value={param.type}
                          onChange={(e) => {
                            const newType = e.target.value as ParamType;
                            const patch: Partial<ParamSpec> = {
                              type: newType,
                              default: defaultForType(newType),
                            };
                            if (newType === 'number') {
                              patch.min = 0;
                              patch.max = 255;
                              patch.format = 'dec';
                            } else if (newType === 'enum') {
                              patch.options = [
                                { value: 'option_1', label: 'Option 1' },
                                { value: 'option_2', label: 'Option 2' },
                              ];
                            }
                            updateParam(index, patch);
                          }}
                        >
                          {PARAM_TYPES.map((t) => (
                            <option key={t.type} value={t.type}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {param.type === 'bool' && (
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={Boolean(param.default)}
                            onChange={(e) => updateParam(index, { default: e.target.checked })}
                          />
                          Default Checked
                        </label>
                      )}

                      {param.type === 'number' && (
                        <label>
                          Number Format
                          <select
                            value={param.format ?? 'dec'}
                            onChange={(e) =>
                              updateParam(index, {
                                format: e.target.value as 'hex' | 'dec',
                              })
                            }
                          >
                            <option value="dec">Decimal (0..255)</option>
                            <option value="hex">Hexadecimal ($00..$FF)</option>
                          </select>
                        </label>
                      )}

                      {(param.type === 'text' || param.type === 'multiline') && (
                        <label>
                          Default Text
                          <input
                            value={String(param.default ?? '')}
                            onChange={(e) => updateParam(index, { default: e.target.value })}
                          />
                        </label>
                      )}

                      {param.type === 'map16' && (
                        <label>
                          Default Tile (Hex)
                          <input
                            value={`$${Number(param.default ?? 0x130)
                              .toString(16)
                              .toUpperCase()}`}
                            onChange={(e) => {
                              const hex = parseInt(e.target.value.replace(/[^0-9a-fA-F]/g, ''), 16);
                              if (!isNaN(hex) && hex <= 0xffff) {
                                updateParam(index, { default: hex });
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {param.type === 'number' && (
                      <div className="form-grid-3">
                        <label>
                          Default Value
                          <input
                            type="number"
                            value={Number(param.default ?? 0)}
                            onChange={(e) =>
                              updateParam(index, { default: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          Minimum
                          <input
                            type="number"
                            value={param.min ?? 0}
                            onChange={(e) => updateParam(index, { min: Number(e.target.value) })}
                          />
                        </label>
                        <label>
                          Maximum
                          <input
                            type="number"
                            value={param.max ?? 255}
                            onChange={(e) => updateParam(index, { max: Number(e.target.value) })}
                          />
                        </label>
                      </div>
                    )}

                    {param.type === 'enum' && (
                      <div className="enum-options-box">
                        <strong>Dropdown Options</strong>
                        <div className="enum-options-list">
                          {(param.options ?? []).map((opt, optIndex) => (
                            <div key={optIndex} className="enum-option-row">
                              <input
                                placeholder="Value (e.g. left)"
                                value={String(opt.value)}
                                onChange={(e) => {
                                  const updatedOptions = [...(param.options ?? [])];
                                  updatedOptions[optIndex] = { ...opt, value: e.target.value };
                                  updateParam(index, { options: updatedOptions });
                                }}
                              />
                              <input
                                placeholder="Label (e.g. Left)"
                                value={opt.label}
                                onChange={(e) => {
                                  const updatedOptions = [...(param.options ?? [])];
                                  updatedOptions[optIndex] = { ...opt, label: e.target.value };
                                  updateParam(index, { options: updatedOptions });
                                }}
                              />
                              <button
                                type="button"
                                className="btn-danger-small"
                                disabled={(param.options ?? []).length <= 1}
                                onClick={() => {
                                  const updatedOptions = (param.options ?? []).filter(
                                    (_, i) => i !== optIndex,
                                  );
                                  const patch: Partial<ParamSpec> = { options: updatedOptions };
                                  if (param.default === opt.value && updatedOptions[0]) {
                                    patch.default = updatedOptions[0].value;
                                  }
                                  updateParam(index, patch);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => {
                            const currentOpts = param.options ?? [];
                            const nextOpt: EnumOption = {
                              value: `opt_${currentOpts.length + 1}`,
                              label: `Option ${currentOpts.length + 1}`,
                            };
                            updateParam(index, { options: [...currentOpts, nextOpt] });
                          }}
                        >
                          + Add Option
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
