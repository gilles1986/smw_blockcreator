import { useMemo, useState } from 'react';
import { generate, GenerateError } from '../core/generator';
import { canonicalJson } from '../core/header';
import { SLOT_IDS, type BlockModel, type BlockProperties, type SlotId } from '../core/model';
import { BlocklyEditor } from './blockly/BlocklyEditor';
import {
  slotsToWorkspaces,
  workspaceProblems,
  workspacesToSlots,
  type WorkspaceState,
} from './blockly/workspace';
import { DISCARD_QUESTION, HAND_EDIT_WARNING, openBlock, saveBlock } from './blockDocument';
import { formatHex, parseHex } from './hex';
import { builtInLibrary as library } from './library';
import { tauriFiles as files } from './tauriFiles';

const TOOL_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

/** Row labels; a Record so a new Slot in the model cannot be forgotten here. */
const SLOT_LABELS: Record<SlotId, string> = {
  marioTop: 'Top',
  marioBottom: 'Bottom',
  marioInside: 'Inside',
};

const NEW_BLOCK: BlockModel = {
  properties: { name: 'new_block', description: '', author: '', defaultActAs: 0x130 },
  slots: {},
};

type Workspaces = Partial<Record<SlotId, WorkspaceState>>;

interface Notice {
  kind: 'info' | 'warning' | 'error';
  text: string;
}

/** The Block file being edited; `revision` changes whenever a Block is opened or created. */
interface OpenFile {
  path: string | undefined;
  revision: number;
  /** Model JSON as last opened or saved, to tell whether there are unsaved changes. */
  savedJson: string;
}

// Variant-C layout: sidebar (properties, Slot rows, file buttons) | editor header / Blockly + ASM.
export function App() {
  const [properties, setProperties] = useState<BlockProperties>(NEW_BLOCK.properties);
  const [workspaces, setWorkspaces] = useState<Workspaces>({});
  const [selected, setSelected] = useState<SlotId>('marioTop');
  const [file, setFile] = useState<OpenFile>({
    path: undefined,
    revision: 0,
    savedJson: canonicalJson(NEW_BLOCK),
  });
  const [notice, setNotice] = useState<Notice | null>(null);

  const model: BlockModel = useMemo(
    () => ({ properties, slots: workspacesToSlots(workspaces, library) }),
    [properties, workspaces],
  );

  const generated = useMemo((): { text: string } | { error: string } => {
    try {
      return { text: generate(model, library, { toolVersion: TOOL_VERSION }).text };
    } catch (error) {
      if (error instanceof GenerateError) return { error: error.message };
      throw error;
    }
  }, [model]);

  const problems = useMemo(
    () => [
      ...new Set(Object.values(workspaces).flatMap((state) => workspaceProblems(state, library))),
    ],
    [workspaces],
  );

  const unsavedChanges = canonicalJson(model) !== file.savedJson;

  function load(next: BlockModel, path: string | undefined) {
    setProperties(next.properties);
    setWorkspaces(slotsToWorkspaces(next.slots, library));
    setSelected('marioTop');
    setFile((current) => ({
      path,
      revision: current.revision + 1,
      savedJson: canonicalJson(next),
    }));
  }

  async function newBlock() {
    if (unsavedChanges) {
      const discard = files
        ? await files.confirm(DISCARD_QUESTION)
        : window.confirm(DISCARD_QUESTION);
      if (!discard) return;
    }
    load(NEW_BLOCK, undefined);
    setNotice(null);
  }

  async function openFile() {
    if (!files) return;
    const outcome = await openBlock(files, { library, unsavedChanges });
    if (outcome.kind === 'failed') setNotice({ kind: 'error', text: outcome.message });
    if (outcome.kind !== 'opened') return;
    load(outcome.model, outcome.path);
    setNotice(outcome.handEdited ? { kind: 'warning', text: HAND_EDIT_WARNING } : null);
  }

  async function saveFile(saveAs: boolean) {
    if (!files) return;
    if ('error' in generated) {
      setNotice({ kind: 'error', text: `Cannot save: ${generated.error}` });
      return;
    }
    const doc = { path: file.path, name: properties.name, text: generated.text, problems };
    const outcome = await saveBlock(files, doc, { saveAs });
    if (outcome.kind === 'blocked' || outcome.kind === 'failed') {
      setNotice({ kind: 'error', text: outcome.message });
    } else if (outcome.kind === 'saved') {
      setFile((current) => ({ ...current, path: outcome.path, savedJson: canonicalJson(model) }));
      setNotice({ kind: 'info', text: `Saved ${outcome.path}` });
    }
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Block">
        <PropertiesForm key={file.revision} properties={properties} onChange={setProperties} />
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
        <section className="save" aria-label="File">
          {notice && (
            <p
              className={`notice ${notice.kind}`}
              role={notice.kind === 'info' ? 'status' : 'alert'}
            >
              {notice.text}
            </p>
          )}
          {file.path && (
            <p className="path" title={file.path}>
              {file.path}
            </p>
          )}
          <div className="buttons" title={files ? undefined : 'Only in the desktop app'}>
            <button type="button" onClick={newBlock}>
              New
            </button>
            <button type="button" disabled={!files} onClick={openFile}>
              Open…
            </button>
            <button type="button" disabled={!files} onClick={() => saveFile(false)}>
              Save
            </button>
            <button type="button" disabled={!files} onClick={() => saveFile(true)}>
              Save as…
            </button>
          </div>
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
              editKey={`${file.revision}:${selected}`}
              initialState={workspaces[selected] ?? {}}
              onChange={(state) => setWorkspaces((all) => ({ ...all, [selected]: state }))}
            />
          </section>
          <section className="asm" aria-label="ASM preview">
            <pre>{'text' in generated ? generated.text : `; ${generated.error}`}</pre>
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
