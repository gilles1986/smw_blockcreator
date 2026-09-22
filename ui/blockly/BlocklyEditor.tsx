import DarkTheme from '@blockly/theme-dark';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Library } from '../../core/library';
import type { SlotKind } from '../../core/model';
import { nameSource, onNamesChanged } from '../names';
import {
  atNeighbourBlockDefinition,
  blockDefinitions,
  fieldValidators,
  missingBlockDefinitions,
  visibilityRules,
} from './blocks';
import { refreshNameFields, setNameSource } from './nameField';
import { enableMultiSelect, type MultiSelect } from './multiselect';
import './multiselect.css';
import './namepicker.css';
import { SelectionBar } from './SelectionBar';
import { toolbox } from './toolbox';
import {
  applyVisibility,
  refreshVisibility,
  setVisibilityRules,
  watchVisibility,
} from './visibility';
import type { WorkspaceState } from './workspace';

interface Props {
  library: Library;
  /** Identifies what is being edited (the Slot); a new key loads `initialState`. */
  editKey: string;
  /** Picks the toolbox: Pieces for the other kind of Slot are hidden. */
  slotKind: SlotKind;
  initialState: WorkspaceState;
  onChange: (state: WorkspaceState) => void;
  /** Block id → warning text shown on that block (Asar errors). */
  warnings?: ReadonlyMap<string, string>;
  /** What the Piece search looks for; the Pieces it finds are the first category of the toolbox. */
  searchQuery?: string;
}

const NO_WARNINGS: ReadonlyMap<string, string> = new Map();
const ASAR_WARNING = 'asar';

/** A Blockly workspace for one Slot at a time (zelos renderer, dark theme). */
export function BlocklyEditor({
  library,
  editKey,
  slotKind,
  initialState,
  onChange,
  warnings = NO_WARNINGS,
  searchQuery = '',
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const multiSelect = useRef<MultiSelect | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const onChangeRef = useRef(onChange);
  const initialStateRef = useRef(initialState);
  const slotKindRef = useRef(slotKind);
  // Layout effects run before the effects below, so they always see the latest props.
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    initialStateRef.current = initialState;
    slotKindRef.current = slotKind;
  });

  useEffect(() => {
    setNameSource(nameSource);
    const rules = visibilityRules(library);
    setVisibilityRules(rules);
    // The placeholders for Pieces the Library does not have come with the Piece blocks.
    Blockly.common.defineBlocksWithJsonArray([
      ...blockDefinitions(library),
      atNeighbourBlockDefinition(),
      ...missingBlockDefinitions(),
    ]);
    for (const { blockType, field, validator } of fieldValidators(library)) {
      const definition = Blockly.Blocks[blockType]!;
      const init = definition.init!;
      definition.init = function (this: Blockly.Block) {
        init.call(this);
        this.getField(field)?.setValidator(validator);
      };
    }
    // A new block starts with the default values, which already decide what is shown.
    for (const blockType of new Set(rules.map((rule) => rule.blockType))) {
      const definition = Blockly.Blocks[blockType]!;
      const init = definition.init!;
      definition.init = function (this: Blockly.Block) {
        init.call(this);
        applyVisibility(this);
      };
    }
    const ws = Blockly.inject(host.current!, {
      toolbox: toolbox(library, slotKindRef.current),
      renderer: 'zelos',
      theme: DarkTheme,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.8 },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    workspace.current = ws;
    const resize = new ResizeObserver(() => Blockly.svgResize(ws));
    resize.observe(host.current!);
    ws.addChangeListener((event) => {
      if (event.isUiEvent || ws.isDragging()) return;
      onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceState);
    });
    multiSelect.current = enableMultiSelect(ws, setSelectedCount);
    // The PIXI sprites are read after the editor starts, and again when the folder is changed.
    const stopNames = onNamesChanged(() => refreshNameFields(ws));
    const stopVisibility = watchVisibility(ws);
    return () => {
      stopNames();
      stopVisibility();
      resize.disconnect();
      multiSelect.current?.dispose();
      multiSelect.current = null;
      setSelectedCount(0);
      ws.dispose();
      workspace.current = null;
    };
  }, [library]);

  useEffect(() => {
    const ws = workspace.current;
    if (!ws) return;
    Blockly.Events.disable();
    try {
      ws.clear();
      Blockly.serialization.workspaces.load(initialStateRef.current, ws);
      // The loaded values, not the defaults, decide which rows are shown.
      refreshVisibility(ws);
      // Re-render from leaves to root so nested conditions (e.g. logic_operation inside if)
      // and blocks whose rows were shown/hidden are properly sized and positioned by Zelos.
      const renderAll = () => {
        for (const block of ws.getAllBlocks(false).reverse()) {
          if (typeof (block as any).render === 'function') {
            (block as any).render();
          }
        }
      };
      renderAll();
      requestAnimationFrame(renderAll);
      // Each Slot starts with its own history; otherwise undo would replay another Slot's edits.
      ws.clearUndo();
    } finally {
      Blockly.Events.enable();
    }
    // The blocks that were selected belong to the Slot that was just left.
    multiSelect.current?.clear();
  }, [editKey, library]);

  useEffect(() => {
    const ws = workspace.current;
    if (!ws) return;
    ws.updateToolbox(toolbox(library, slotKind, searchQuery));
    // Show what the search found: its category is the first one.
    if (searchQuery.trim() !== '') ws.getToolbox()?.selectItemByPosition(0);
  }, [slotKind, library, searchQuery]);

  useEffect(() => {
    const ws = workspace.current;
    if (!ws) return;
    // Warning icons are not part of the saved workspace; keep them out of the change events.
    // The id keeps Asar's warning apart from any other warning a block may carry.
    Blockly.Events.disable();
    try {
      for (const block of ws.getAllBlocks(false)) {
        block.setWarningText(warnings.get(block.id) ?? null, ASAR_WARNING);
      }
    } finally {
      Blockly.Events.enable();
    }
  }, [warnings, editKey, library]);

  return (
    <>
      <div className="blockly-host" ref={host} />
      <SelectionBar
        count={selectedCount}
        run={(action) => multiSelect.current && action(multiSelect.current)}
      />
    </>
  );
}
