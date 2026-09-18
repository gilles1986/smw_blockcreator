import DarkTheme from '@blockly/theme-dark';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Library } from '../../core/library';
import type { SlotKind } from '../../core/model';
import { blockDefinitions, fieldValidators } from './blocks';
import { toolbox } from './toolbox';
import type { WorkspaceState } from './workspace';

interface Props {
  library: Library;
  /** Identifies what is being edited (the Slot); a new key loads `initialState`. */
  editKey: string;
  /** Picks the toolbox: Pieces for the other kind of Slot are hidden. */
  slotKind: SlotKind;
  initialState: WorkspaceState;
  onChange: (state: WorkspaceState) => void;
}

/** A Blockly workspace for one Slot at a time (zelos renderer, dark theme). */
export function BlocklyEditor({ library, editKey, slotKind, initialState, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null);
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
    Blockly.common.defineBlocksWithJsonArray(blockDefinitions(library));
    for (const { blockType, field, validator } of fieldValidators(library)) {
      const definition = Blockly.Blocks[blockType]!;
      const init = definition.init!;
      definition.init = function (this: Blockly.Block) {
        init.call(this);
        this.getField(field)?.setValidator(validator);
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
    return () => {
      resize.disconnect();
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
      // Each Slot starts with its own history; otherwise undo would replay another Slot's edits.
      ws.clearUndo();
    } finally {
      Blockly.Events.enable();
    }
  }, [editKey, library]);

  useEffect(() => {
    workspace.current?.updateToolbox(toolbox(library, slotKind));
  }, [slotKind, library]);

  return <div className="blockly-host" ref={host} />;
}
