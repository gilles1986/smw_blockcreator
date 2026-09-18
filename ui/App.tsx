import { useMemo, useState } from 'react';
import { generate, GenerateError } from '../core/generator';
import { SLOT_IDS, type BlockModel, type BlockProperties, type SlotId } from '../core/model';
import { BlocklyEditor } from './blockly/BlocklyEditor';
import { workspacesToSlots, type WorkspaceState } from './blockly/workspace';
import { formatHex, parseHex } from './hex';
import { builtInLibrary as library } from './library';

const TOOL_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

/** Row labels; a Record so a new Slot in the model cannot be forgotten here. */
const SLOT_LABELS: Record<SlotId, string> = {
  marioTop: 'Top',
  marioBottom: 'Bottom',
  marioInside: 'Inside',
};

const NEW_BLOCK: BlockProperties = {
  name: 'new_block',
  description: '',
  author: '',
  defaultActAs: 0x130,
};

// Variant-C layout: sidebar (properties, Slot rows) | editor header / Blockly + live ASM.
export function App() {
  const [properties, setProperties] = useState<BlockProperties>(NEW_BLOCK);
  const [workspaces, setWorkspaces] = useState<Partial<Record<SlotId, WorkspaceState>>>({});
  const [selected, setSelected] = useState<SlotId>('marioTop');

  const model: BlockModel = useMemo(
    () => ({ properties, slots: workspacesToSlots(workspaces, library) }),
    [properties, workspaces],
  );

  const asm = useMemo(() => {
    try {
      return generate(model, library, { toolVersion: TOOL_VERSION }).text;
    } catch (error) {
      if (error instanceof GenerateError) return `; ${error.message}`;
      throw error;
    }
  }, [model]);

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Block">
        <PropertiesForm properties={properties} onChange={setProperties} />
        <section className="slots" aria-label="Slots">
          <h2 className="group">Mario</h2>
          {SLOT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`slot-row${id === selected ? ' selected' : ''}${model.slots[id] ? ' filled' : ''}`}
              aria-pressed={id === selected}
              onClick={() => setSelected(id)}
            >
              <span className="dot" aria-label={model.slots[id] ? 'has logic' : 'empty'} />
              <span className="name">{SLOT_LABELS[id]}</span>
            </button>
          ))}
        </section>
      </aside>
      <main className="main">
        <header className="edhead">
          <strong>Mario · {SLOT_LABELS[selected]}</strong>
        </header>
        <div className="split">
          <section className="editor" aria-label="Logic editor">
            <BlocklyEditor
              library={library}
              editKey={selected}
              initialState={workspaces[selected] ?? {}}
              onChange={(state) => setWorkspaces((all) => ({ ...all, [selected]: state }))}
            />
          </section>
          <section className="asm" aria-label="ASM preview">
            <pre>{asm}</pre>
          </section>
        </div>
      </main>
    </div>
  );
}

function PropertiesForm({
  properties,
  onChange,
}: {
  properties: BlockProperties;
  onChange: (properties: BlockProperties) => void;
}) {
  const set = (patch: Partial<BlockProperties>) => onChange({ ...properties, ...patch });
  const [actAsText, setActAsText] = useState(formatHex(properties.defaultActAs, 3));
  return (
    <section className="props" aria-label="Block properties">
      <h1>BlockCreator</h1>
      <label>
        Name
        <input value={properties.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label>
        Description
        <textarea
          rows={2}
          value={properties.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </label>
      <label>
        Author
        <input value={properties.author} onChange={(e) => set({ author: e.target.value })} />
      </label>
      <label>
        Default act as
        <input
          value={actAsText}
          onChange={(e) => {
            setActAsText(e.target.value);
            const value = parseHex(e.target.value);
            if (value !== undefined && value <= 0xffff) set({ defaultActAs: value });
          }}
        />
      </label>
    </section>
  );
}
