import { useCallback, useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { checkBlock, type CheckProblem } from '../core/assemble';
import { generate, GenerateError, type GenerateResult } from '../core/generator';
import { canonicalJson } from '../core/header';
import {
  cornerFollowsTop,
  effectiveSlot,
  slotKind,
  type BlockModel,
  type BlockProperties,
  type SlotId,
} from '../core/model';
import { AboutDialog } from './About';
import { BlocklyEditor } from './blockly/BlocklyEditor';
import { MenuBar } from './MenuBar';
import { PieceManagerDialog } from './pieceEditor/PieceManagerDialog';
import {
  slotsToWorkspaces,
  workspaceProblems,
  workspacesToSlots,
  type WorkspaceState,
} from './blockly/workspace';
import { DISCARD_QUESTION, openBlock, saveBlock } from './blockDocument';
import { formatHex, parseHex } from './hex';
import { ImportDialog } from './ImportDialog';
import { parseBlockText } from './importBlock';
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
import { mergeLibraries, type Library } from '../core/library';
import { builtInLibrary } from './library';
import { onceWarnings } from './onceWarnings';
import { openNotice } from './openNotice';
import { PresetDialog } from './PresetDialog';
import { presetList, type Preset } from './presets';
import { propertyProblems } from './properties';
import { saveToProject, type ListChoice, type RoutineFile } from './projectSave';
import { routineFilesNote, savedToProjectNotice } from './routineNotes';
import { getAsmOpen, getFolder, setAsmOpen } from './settings';
import { SaveToProjectDialog } from './SaveToProjectDialog';
import { SettingsDialog } from './SettingsDialog';
import { copySlot } from './slotOps';
import { SlotList } from './SlotList';
import { stackWarnings } from './stackWarnings';
import { SlotGlyph } from './SlotGlyph';
import { groupName, SLOT_GLYPHS, SLOT_HINTS, SLOT_LABELS } from './slots';
import { gpsAsar, gpsFolder } from './tauriAsar';
import { tauriFiles as files } from './tauriFiles';
import { loadPixiSprites } from './tauriNames';
import { projectFiles } from './tauriProject';
import { loadUserLibrary, userLibrarySupported } from './userLibrary';

const TOOL_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

const NEW_BLOCK: BlockModel = {
  properties: { name: 'new_block', description: '', author: '', defaultActAs: 0x130 },
  slots: {},
};

type Workspaces = Partial<Record<SlotId, WorkspaceState>>;

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
  /** Whether the ASM pane takes its column; folded away, the editor gets the room. */
  const [asmOpen, setAsmOpenState] = useState(getAsmOpen);
  /** The last Asar check and the text it checked; it no longer applies once the text changes. */
  const [check, setCheck] = useState<{ text: string; problems: CheckProblem[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [piecesOpen, setPiecesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  /** What the Piece search box looks for. */
  const [query, setQuery] = useState('');
  /** The user's own Pieces, loaded from the app's data dir; null until read (browser: never). */
  const [userLibrary, setUserLibrary] = useState<Library | null>(null);
  const library = useMemo(
    () => (userLibrary ? mergeLibraries(builtInLibrary, userLibrary) : builtInLibrary),
    [userLibrary, builtInLibrary],
  );
  const presets = useMemo(() => presetList(library), [library]);
  /** The GPS folder the "Save to project" dialog is open for; undefined while it is closed. */
  const [projectFolder, setProjectFolder] = useState<string>();
  const project = useMemo(
    () => (projectFolder === undefined ? undefined : projectFiles(projectFolder)),
    [projectFolder],
  );

  useEffect(() => {
    const displayVersion = TOOL_VERSION.startsWith('v') ? TOOL_VERSION : `v${TOOL_VERSION}`;
    const prefix = isTauri() ? 'BlockCreator' : 'Saphros BlockCreator';
    document.title = `${prefix} ${displayVersion}`;
  }, []);

  // The custom sprite names come from the PIXI folder in the settings: read at the start, and
  // again whenever the settings dialog has been closed (the folder may have changed).
  useEffect(() => {
    if (!settingsOpen) void loadPixiSprites();
  }, [settingsOpen]);

  /** Shows the user Library's problems as a notice, when it has any. */
  function reportLibraryErrors(user: Library) {
    if (user.errors.length === 0) return;
    const first = user.errors[0]!;
    setNotice({
      kind: 'error',
      text: `Your Pieces: ${user.errors.length} problem${user.errors.length === 1 ? '' : 's'}, first: ${first.file}: ${first.message}`,
    });
  }

  const reloadUserLibrary = useCallback(async () => {
    if (!userLibrarySupported) return;
    try {
      const user = await loadUserLibrary();
      setUserLibrary(user);
      reportLibraryErrors(user);
    } catch (error) {
      setNotice({ kind: 'error', text: `Cannot read your Pieces: ${String(error)}` });
    }
  }, []);

  // Read the user's Pieces once at the start.
  useEffect(() => {
    void reloadUserLibrary();
  }, [reloadUserLibrary]);

  const model: BlockModel = useMemo(
    () => ({
      properties,
      slots: workspacesToSlots(workspaces, library),
      ...(Object.keys(slotLinks).length > 0 && { slotLinks }),
      // Written only when switched off, so the default stays out of the file.
      ...(!topCornerFollowsTop && { topCornerFollowsTop }),
    }),
    [properties, workspaces, slotLinks, topCornerFollowsTop, library],
  );

  const generated = useMemo((): GenerateResult | { error: string } => {
    try {
      return generate(model, library, { toolVersion: TOOL_VERSION });
    } catch (error) {
      if (error instanceof GenerateError) return { error: error.message };
      throw error;
    }
  }, [model, library]);

  const problems = useMemo(
    () => [
      ...new Set(Object.values(workspaces).flatMap((state) => workspaceProblems(state, library))),
    ],
    [workspaces, library],
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

  function toggleAsm() {
    setAsmOpenState(!asmOpen);
    setAsmOpen(!asmOpen);
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

  /** Asks first when there are unsaved changes; false when the user wants to keep them. */
  async function mayDiscard(): Promise<boolean> {
    if (!unsavedChanges) return true;
    return files ? files.confirm(DISCARD_QUESTION) : window.confirm(DISCARD_QUESTION);
  }

  async function newBlock() {
    if (!(await mayDiscard())) return;
    load(NEW_BLOCK, undefined);
    setNotice(null);
  }

  /** Starts from a copy of a Preset; it has no file yet, so Save asks where it goes. */
  async function newFromPreset(preset: Preset) {
    if (!(await mayDiscard())) return;
    load(preset.model, undefined);
    setNotice(null);
  }

  function openBrowserFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.asm';
    input.onchange = async () => {
      const selectedFile = input.files?.[0];
      if (!selectedFile) return;
      try {
        const text = await selectedFile.text();
        const parsed = parseBlockText(text, library);
        if (!parsed.ok) {
          setNotice({ kind: 'error', text: parsed.message });
          return;
        }
        load(parsed.model, selectedFile.name);
        setNotice({ kind: 'info', text: `Opened ${selectedFile.name}` });
      } catch (error) {
        setNotice({ kind: 'error', text: `Cannot read file: ${String(error)}` });
      }
    };
    input.click();
  }

  function downloadAsm(name: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.endsWith('.asm') ? name : `${name}.asm`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openFile() {
    if (!files) {
      if (!(await mayDiscard())) return;
      openBrowserFile();
      return;
    }
    const outcome = await openBlock(files, { library, unsavedChanges });
    if (outcome.kind === 'failed') setNotice({ kind: 'error', text: outcome.message });
    if (outcome.kind !== 'opened') return;
    load(outcome.model, outcome.path);
    setNotice(openNotice(outcome));
  }

  async function saveFile(saveAs: boolean) {
    if ('error' in generated) {
      setNotice({ kind: 'error', text: `Cannot save: ${generated.error}` });
      return;
    }
    if (!files) {
      const fileName = properties.name ? `${properties.name}.asm` : 'block.asm';
      downloadAsm(fileName, generated.text);
      setFile((current) => ({
        ...current,
        path: fileName,
        revision: current.revision + 1,
        savedJson: canonicalJson(model),
      }));
      setNotice({ kind: 'info', text: `Downloaded ${fileName}` });
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
    // A plain save cannot copy the routines; say which files the Block needs and where they go.
    const routineNote = routineFilesNote(generated.routines, getFolder('gpsFolder'));
    if (routineNote === undefined) setNotice(verdict.notice);
    else if (verdict.notice) {
      setNotice({ kind: 'warning', text: `${verdict.notice.text}\n${routineNote}` });
    } else setNotice({ kind: 'info', text: routineNote });
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
    const doc = {
      name: properties.name,
      text: generated.text,
      problems,
      routines: routineFilesOf(generated.routines),
    };
    const outcome = await saveToProject(project, doc, list);
    if (outcome.kind === 'blocked' || outcome.kind === 'failed') {
      setNotice({ kind: 'error', text: outcome.message });
      return;
    }
    if (outcome.kind === 'cancelled') return;
    setFile((current) => ({ ...current, savedJson: canonicalJson(model) }));
    const saved = savedToProjectNotice(outcome, list);
    setNotice(
      verdict.notice ? { kind: 'warning', text: `${saved.text}\n${verdict.notice.text}` } : saved,
    );
  }

  /** The routines a Block needs as BlockCreator ships them; one the Library lacks is left out. */
  function routineFilesOf(names: readonly string[]): RoutineFile[] {
    return names.flatMap((name) => {
      const routine = library.routines.get(name);
      return routine ? [{ name, text: routine.text }] : [];
    });
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
  /** Puts a copy of one Slot's logic into another; the editor reloads to show it. */
  function copyLogic(from: SlotId, to: SlotId) {
    const next = copySlot({ workspaces, slotLinks }, from, to);
    setWorkspaces(next.workspaces);
    setSlotLinks(next.slotLinks);
    // The Slot on show may be the target: a new revision makes the editor load its logic again.
    setFile((current) => ({ ...current, revision: current.revision + 1 }));
  }

  const activeWorkspace = workspaces[activeSlot];
  // Warning icons on blocks: one-shot Actions that would repeat, a second stack, and Asar's
  // errors when checked.
  const warnings = useMemo(() => {
    const found = onceWarnings(activeWorkspace ?? {}, library);
    for (const [id, text] of stackWarnings(activeWorkspace ?? {}, library)) {
      const earlier = found.get(id);
      found.set(id, earlier ? `${earlier}\n${text}` : text);
    }
    if (checked) {
      for (const [id, text] of blockWarnings(
        checked.problems,
        activeSlot,
        activeWorkspace ?? {},
        library,
      )) {
        const earlier = found.get(id);
        found.set(id, earlier ? `${earlier}\n${text}` : text);
      }
    }
    return found.size > 0 ? found : undefined;
  }, [checked, activeSlot, activeWorkspace, library]);

  return (
    <div className="app">
      <MenuBar
        version={TOOL_VERSION}
        filePath={file.path}
        unsavedChanges={unsavedChanges}
        desktopFilesSupported={Boolean(files)}
        checking={checking}
        onNew={newBlock}
        onOpen={openFile}
        onImport={() => setImportOpen(true)}
        onSave={() => saveFile(false)}
        onSaveAs={() => saveFile(true)}
        onSaveToProject={openProjectDialog}
        onOpenPresets={() => setPresetsOpen(true)}
        onOpenPieces={() => setPiecesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-scroll">
            <PropertiesForm key={file.revision} properties={properties} onChange={setProperties} />
            <SlotList
              model={model}
              library={library}
              selected={selected}
              onSelect={setSelected}
              onLink={setLink}
              onCopy={copyLogic}
              onCornerFollowsTop={setTopCornerFollowsTop}
              errorSlots={checked ? slotsWithProblems(checked.problems) : undefined}
            />
          </div>
          {((checked && checked.problems.length > 0) || notice || unsavedChanges || file.path) && (
            <section className="sidebar-status">
              {checked && checked.problems.length > 0 && (
                <p className="notice error">
                  Asar found {checked.problems.length} error
                  {checked.problems.length === 1 ? '' : 's'} (see the ASM pane); fix them before
                  saving.
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
            </section>
          )}
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
            {selected === 'marioTopCorner' && cornerFollowsTop(model) && !activeLink && (
              <span className="hint">
                It does what Top does while it is empty (switch in the Slot list). Add blocks here
                to give the corner its own logic.
              </span>
            )}
            <input
              type="search"
              className="piece-search"
              placeholder="Search Pieces…"
              aria-label="Search Pieces"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </header>
          <div className={asmOpen ? 'split' : 'split asm-folded'}>
            <section className="editor" aria-label="Logic editor">
              <BlocklyEditor
                library={library}
                editKey={`${file.revision}:${activeSlot}`}
                slotKind={slotKind(activeSlot)}
                initialState={workspaces[activeSlot] ?? {}}
                onChange={(state) => setWorkspaces((all) => ({ ...all, [activeSlot]: state }))}
                warnings={warnings}
                searchQuery={query}
              />
            </section>
            <section className={asmOpen ? 'asm' : 'asm folded'} aria-label="ASM preview">
              {asmOpen ? (
                <>
                  <div className="asm-head">
                    <span className="asm-title">ASM Preview</span>
                    <button
                      type="button"
                      className="btn-copy"
                      onClick={() => setImportOpen(true)}
                      title="Import block from ASM code or JSON"
                    >
                      Import
                    </button>
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
                    <button
                      type="button"
                      className="btn-copy"
                      onClick={toggleAsm}
                      aria-expanded
                      aria-label="Hide ASM preview"
                      title="Hide the ASM preview to give the editor more room"
                    >
                      »
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
                </>
              ) : (
                <button
                  type="button"
                  className="asm-unfold"
                  onClick={toggleAsm}
                  aria-expanded={false}
                  aria-label="Show ASM preview"
                  title={
                    checked && checked.problems.length > 0
                      ? 'Show the ASM preview (the last check found problems)'
                      : 'Show the ASM preview'
                  }
                >
                  <span aria-hidden="true">«</span>
                  <span className="asm-unfold-title">ASM Preview</span>
                  {checked && checked.problems.length > 0 && (
                    <span className="asm-unfold-alert" aria-hidden="true">
                      !
                    </span>
                  )}
                </button>
              )}
            </section>
          </div>
        </main>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PresetDialog
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        presets={presets}
        onPick={newFromPreset}
      />
      <PieceManagerDialog
        open={piecesOpen}
        onClose={() => setPiecesOpen(false)}
        library={library}
        userLibrary={userLibrary}
        onLibraryChanged={reloadUserLibrary}
        defaultAuthor={properties.author}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} version={TOOL_VERSION} />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        library={library}
        onImport={async (importedModel) => {
          if (!(await mayDiscard())) return;
          load(importedModel, undefined);
          setNotice({
            kind: 'info',
            text: `Imported block: ${importedModel.properties.name || 'Untitled'}`,
          });
        }}
      />
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
  const problems = propertyProblems(properties.name, actAsText);
  return (
    <section className="props" aria-label="Block properties">
      <div className="app-title-row">
        <h1>Block Properties</h1>
      </div>
      <label>
        Name
        <input
          value={properties.name}
          aria-invalid={problems.name !== undefined}
          onChange={(e) => set({ name: e.target.value })}
        />
        {problems.name && <span className="field-problem">{problems.name}</span>}
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
          aria-invalid={problems.defaultActAs !== undefined}
          onChange={(e) => {
            setActAsText(e.target.value);
            const value = parseHex(e.target.value);
            if (value !== undefined && value <= 0xffff) set({ defaultActAs: value });
          }}
        />
        {problems.defaultActAs && <span className="field-problem">{problems.defaultActAs}</span>}
      </label>
    </section>
  );
}
