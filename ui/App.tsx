import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { checkBlock, type CheckProblem } from '../core/assemble';
import { generate, GenerateError, type GenerateResult } from '../core/generator';
import { canonicalJson } from '../core/header';
import {
  cornerFollowsTop,
  effectiveSlot,
  slotFilled,
  slotKind,
  type BlockModel,
  type BlockProperties,
  type SlotId,
} from '../core/model';
import { About } from './About';
import { BlocklyEditor } from './blockly/BlocklyEditor';
import { NewIcon, OpenIcon, ProjectIcon, SaveAsIcon, SaveIcon, SettingsIcon } from './icons';
import {
  slotsToWorkspaces,
  workspaceProblems,
  workspacesToSlots,
  type WorkspaceState,
} from './blockly/workspace';
import { DISCARD_QUESTION, HAND_EDIT_WARNING, openBlock, saveBlock } from './blockDocument';
import { formatHex, parseHex } from './hex';
import { CheckResults } from './CheckResults';
import {
  blockWarnings,
  checkNotice,
  problemPieceName,
  saveVerdict,
  slotsWithProblems,
  type CheckOutcome,
  type Notice,
} from './checkView';
import { builtInLibrary as library } from './library';
import { saveToProject, type ListChoice } from './projectSave';
import { SaveToProjectDialog } from './SaveToProjectDialog';
import { SettingsDialog } from './SettingsDialog';
import { SlotList } from './SlotList';
import { SlotGlyph } from './SlotGlyph';
import { groupName, SLOT_GLYPHS, SLOT_HINTS, SLOT_LABELS } from './slots';
import { gpsAsar, gpsFolder } from './tauriAsar';
import { tauriFiles as files } from './tauriFiles';
import { loadPixiSprites } from './tauriNames';
import { projectFiles } from './tauriProject';

const TOOL_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

const NEW_BLOCK: BlockModel = {
  properties: { name: 'new_block', description: '', author: '', defaultActAs: 0x130 },
  slots: {},
};

type Workspaces = Partial<Record<SlotId, WorkspaceState>>;

/** Tooltip of a button that needs the desktop app's file access. */
const desktopOnly = (label: string) => (files ? label : `${label} (desktop app only)`);

/** A sidebar button that shows only an icon; the label is its tooltip and accessible name. */
function IconButton({
  label,
  disabled,
  className = '',
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`.trim()}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
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
  /** The last Asar check and the text it checked; it no longer applies once the text changes. */
  const [check, setCheck] = useState<{ text: string; problems: CheckProblem[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** The GPS folder the "Save to project" dialog is open for; undefined while it is closed. */
  const [projectFolder, setProjectFolder] = useState<string>();
  const project = useMemo(
    () => (projectFolder === undefined ? undefined : projectFiles(projectFolder)),
    [projectFolder],
  );

  // The custom sprite names come from the PIXI folder in the settings: read at the start, and
  // again whenever the settings dialog has been closed (the folder may have changed).
  useEffect(() => {
    if (!settingsOpen) void loadPixiSprites();
  }, [settingsOpen]);

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

  const generated = useMemo((): GenerateResult | { error: string } => {
    try {
      return generate(model, library, { toolVersion: TOOL_VERSION });
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

  const checked = check && 'text' in generated && check.text === generated.text ? check : null;

  /**
   * Assembles the current Block with the GPS project's Asar; the errors are shown through
   * `check`. Nothing here throws: whatever went wrong is in the outcome.
   */
  async function runCheck(): Promise<CheckOutcome> {
    if (!('text' in generated)) return { kind: 'unavailable', reason: generated.error };
    setChecking(true);
    try {
      const { asar, message } = await gpsAsar();
      if (!asar) return { kind: 'unavailable', reason: message };
      const routines = [...(await asar.routines()), ...library.routines.keys()];
      const found = await checkBlock(generated, routines, asar.run);
      setCheck({ text: generated.text, problems: found });
      return found.length > 0 ? { kind: 'errors', problems: found } : { kind: 'passed' };
    } catch (error) {
      return { kind: 'failed', message: String(error) };
    } finally {
      setChecking(false);
    }
  }

  async function checkOnly() {
    setNotice(checkNotice(await runCheck()));
  }

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
    // Errors block the save; they stay on screen through `check`.
    const verdict = saveVerdict(await runCheck());
    if (!verdict.save) return;
    const doc = { path: file.path, name: properties.name, text: generated.text, problems };
    const outcome = await saveBlock(files, doc, { saveAs });
    if (outcome.kind === 'blocked' || outcome.kind === 'failed') {
      setNotice({ kind: 'error', text: outcome.message });
      return;
    }
    if (outcome.kind === 'cancelled') return;
    setFile({
      path: outcome.path,
      revision: file.revision + 1,
      savedJson: canonicalJson(model),
    });
    setNotice(verdict.notice);
  }

  /** Opens the "Save to project" dialog, asking for the GPS folder first if none is set. */
  async function openProjectDialog() {
    if ('error' in generated) {
      setNotice({ kind: 'error', text: `Cannot save: ${generated.error}` });
      return;
    }
    const { folder, message } = await gpsFolder();
    if (folder === undefined) {
      if (message !== undefined) setNotice({ kind: 'error', text: message });
      return;
    }
    setProjectFolder(folder);
  }

  /** Checks the Block, then saves it into the GPS project (and into list.txt when `list` is set). */
  async function saveToGpsProject(list: ListChoice | undefined) {
    if (!project || 'error' in generated) return;
    // Errors block the save; they stay on screen through `check`.
    const verdict = saveVerdict(await runCheck());
    if (!verdict.save) return;
    const doc = { name: properties.name, text: generated.text, problems };
    const outcome = await saveToProject(project, doc, list);
    if (outcome.kind === 'blocked' || outcome.kind === 'failed') {
      setNotice({ kind: 'error', text: outcome.message });
      return;
    }
    if (outcome.kind === 'cancelled') return;
    setFile((current) => ({ ...current, savedJson: canonicalJson(model) }));
    const added =
      outcome.listUpdated && list
        ? ` and put it in list.txt at ${formatHex(list.tile, 4)} (the old list is list.txt.bak)`
        : '';
    const saved = `Saved ${outcome.path}${added}. Run GPS (or Callisto's Update) to insert it.`;
    setNotice(
      verdict.notice
        ? { kind: 'warning', text: `${saved}\n${verdict.notice.text}` }
        : { kind: 'info', text: saved },
    );
  }

  const activeLink = slotLinks[selected];
  const activeSlot = effectiveSlot(model, selected);

  /** Links a Slot to another Slot's logic, or makes it individual again (keeping a copy). */
  function setLink(slot: SlotId, target: SlotId | undefined) {
    setSlotLinks((all) => {
      const next = { ...all };
      if (target) {
        next[slot] = target;
      } else {
        delete next[slot];
      }
      return next;
    });
    if (!target) {
      const source = effectiveSlot(model, slot);
      setWorkspaces((all) => ({
        ...all,
        [slot]: all[source] ?? {},
      }));
    }
  }
  const activeWorkspace = workspaces[activeSlot];
  const warnings = useMemo(
    () =>
      checked
        ? blockWarnings(checked.problems, activeSlot, activeWorkspace ?? {}, library)
        : undefined,
    [checked, activeSlot, activeWorkspace],
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-scroll">
          <PropertiesForm properties={properties} onChange={setProperties} />
          <SlotList
            model={model}
            selected={selected}
            onSelect={setSelected}
            onLink={setLink}
            errorSlots={checked ? slotsWithProblems(checked.problems) : undefined}
          />
        </div>
        <section className="save">
          {checked && checked.problems.length > 0 && (
            <p className="notice error">
              Asar found {checked.problems.length} error{checked.problems.length === 1 ? '' : 's'}{' '}
              (see the ASM pane); fix them before saving.
            </p>
          )}
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
          <div className="buttons">
            <IconButton label="New" onClick={newBlock}>
              <NewIcon />
            </IconButton>
            <IconButton label={desktopOnly('Open…')} disabled={!files} onClick={openFile}>
              <OpenIcon />
            </IconButton>
            <IconButton
              label={desktopOnly('Save')}
              disabled={!files || checking}
              onClick={() => saveFile(false)}
            >
              <SaveIcon />
            </IconButton>
            <IconButton
              label={desktopOnly('Save as…')}
              disabled={!files || checking}
              onClick={() => saveFile(true)}
            >
              <SaveAsIcon />
            </IconButton>
            <IconButton
              label={desktopOnly('Save to GPS project…')}
              disabled={!files || checking}
              onClick={openProjectDialog}
            >
              <ProjectIcon />
            </IconButton>
            <IconButton
              label={desktopOnly('Settings')}
              className="push-right"
              disabled={!files}
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon />
            </IconButton>
            <About version={TOOL_VERSION} />
          </div>
          <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          {project && projectFolder !== undefined && (
            <SaveToProjectDialog
              open
              onClose={() => setProjectFolder(undefined)}
              project={project}
              gpsFolder={projectFolder}
              name={properties.name}
              defaultActAs={properties.defaultActAs}
              onSave={saveToGpsProject}
            />
          )}
        </section>
      </aside>
      <main className="main">
        <header className="edhead">
          <div className="slot-title">
            <SlotGlyph glyph={SLOT_GLYPHS[selected]} size={34} />
            <div className="slot-text">
              <strong>
                {groupName(selected)} · {SLOT_LABELS[selected]}
              </strong>
              <span className="slot-hint">{SLOT_HINTS[selected]}</span>
            </div>
          </div>
          {activeLink && (
            <span className="linked-indicator">🔗 Uses {SLOT_LABELS[activeLink]}'s logic</span>
          )}
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
              warnings={warnings}
            />
          </section>
          <section className="asm" aria-label="ASM preview">
            <div className="asm-head">
              <span className="asm-title">ASM Preview</span>
              <button
                type="button"
                className="btn-copy"
                onClick={checkOnly}
                disabled={checking || !('text' in generated)}
                title="Assemble with the GPS project's Asar"
              >
                {checking ? 'Checking…' : 'Check'}
              </button>
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
            {checked && (
              <CheckResults
                problems={checked.problems}
                pieceName={(problem) => problemPieceName(problem, model.slots, library)}
                onSelectSlot={setSelected}
              />
            )}
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
