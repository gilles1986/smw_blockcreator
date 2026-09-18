import { useMemo, useState } from 'react';
import { generate, GenerateError } from '../core/generator';
import { canonicalJson } from '../core/header';
import {
  cornerFollowsTop,
  effectiveSlot,
  slotFilled,
  slotKind,
  SLOT_IDS,
  type BlockModel,
  type BlockProperties,
  type SlotId,
} from '../core/model';
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
import { SlotList } from './SlotList';
import { groupName, SLOT_LABELS } from './slots';
import { tauriFiles as files } from './tauriFiles';

const TOOL_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

const NEW_BLOCK: BlockModel = {
  properties: { name: 'new_block', description: '', author: '', defaultActAs: 0x130 },
  slots: {},
};

type Workspaces = Partial<Record<SlotId, WorkspaceState>>;

interface Notice {
  kind: 'warning' | 'error';
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
  const [slotLinks, setSlotLinks] = useState<Partial<Record<SlotId, SlotId>>>({});
  const [selected, setSelected] = useState<SlotId>('marioTop');
  const [topCornerFollowsTop, setTopCornerFollowsTop] = useState(true);
  const [file, setFile] = useState<OpenFile>({
    path: undefined,
    revision: 0,
    savedJson: canonicalJson(NEW_BLOCK),
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);

  const model: BlockModel = useMemo(
    () => ({
      properties,
      slots: workspacesToSlots(workspaces, library),
      ...(Object.keys(slotLinks).length > 0 && { slotLinks }),
      // Written only when switched off, so the default stays out of the file.
      ...(!topCornerFollowsTop && { topCornerFollowsTop }),
    }),
    [properties, workspaces, slotLinks, topCornerFollowsTop],
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
    setSlotLinks(next.slotLinks ?? {});
    setTopCornerFollowsTop(next.topCornerFollowsTop !== false);
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
      return;
    }
    setFile({
      path: outcome.path,
      revision: file.revision + 1,
      savedJson: canonicalJson(model),
    });
    setNotice(null);
  }

  const currentKind = slotKind(selected);
  const eligibleLinkTargets = SLOT_IDS.filter(
    (s) =>
      s !== selected &&
      slotKind(s) === currentKind &&
      slotLinks[s] !== selected,
  );
  const activeLink = slotLinks[selected];
  const activeSlot = effectiveSlot(model, selected);

  return (
    <div className="app">
      <aside className="sidebar">
        <PropertiesForm properties={properties} onChange={setProperties} />
        <SlotList model={model} selected={selected} onSelect={setSelected} />
        <section className="save">
          {notice && <p className={`notice ${notice.kind}`}>{notice.text}</p>}
          {unsavedChanges && (
            <p className="notice warning" role="status">
              Unsaved changes
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
          <div className="slot-title">
            <strong>
              {groupName(selected)} · {SLOT_LABELS[selected]}
            </strong>
          </div>
          <div className="slot-link-control">
            <label className="link-select-label">
              <span>Same logic as:</span>
              <select
                className="link-select"
                value={activeLink ?? ''}
                onChange={(e) => {
                  const target = (e.target.value || undefined) as SlotId | undefined;
                  setSlotLinks((all) => {
                    const next = { ...all };
                    if (target) {
                      next[selected] = target;
                    } else {
                      delete next[selected];
                    }
                    return next;
                  });
                  if (!target && activeSlot) {
                    setWorkspaces((all) => ({
                      ...all,
                      [selected]: all[activeSlot] ?? {},
                    }));
                  }
                }}
              >
                <option value="">(Independent logic)</option>
                {eligibleLinkTargets.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            {activeLink && (
              <span className="linked-indicator">
                🔗 Uses {SLOT_LABELS[activeLink]}'s logic
              </span>
            )}
          </div>
          {selected === 'marioTopCorner' && !slotFilled(model, 'marioTopCorner') && !activeLink && (
            <label className="link">
              <input
                type="checkbox"
                checked={topCornerFollowsTop}
                onChange={(e) => setTopCornerFollowsTop(e.target.checked)}
              />
              While empty, do what Top does
            </label>
          )}
          {selected === 'marioTopCorner' && cornerFollowsTop(model) && !activeLink && (
            <span className="hint">Add blocks here to give the corner its own logic.</span>
          )}
        </header>
        <div className="split">
          <section className="editor" aria-label="Logic editor">
            <BlocklyEditor
              library={library}
              editKey={`${file.revision}:${activeSlot}`}
              slotKind={slotKind(activeSlot)}
              initialState={workspaces[activeSlot] ?? {}}
              onChange={(state) => setWorkspaces((all) => ({ ...all, [activeSlot]: state }))}
            />
          </section>
          <section className="asm" aria-label="ASM preview">
            <div className="asm-head">
              <span className="asm-title">ASM Preview</span>
              <button
                type="button"
                className="btn-copy"
                onClick={async () => {
                  if ('text' in generated) {
                    await navigator.clipboard.writeText(generated.text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                disabled={!('text' in generated)}
                title="Copy ASM code to clipboard"
              >
                {copied ? '✓ Copied!' : 'Copy ASM'}
              </button>
            </div>
            <pre className="asm-code">
              {'text' in generated ? generated.text : `; ${generated.error}`}
            </pre>
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
