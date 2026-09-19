// Selecting several blocks of a Blockly workspace at once. Blockly 13 selects one block at a time
// (its focus system), so the extra selection lives here: a set of block ids, drawn with a CSS
// class. Shift+click toggles a block, Shift+drag draws a frame, Ctrl+A selects all; with a selection
// Ctrl+C / X / V and Delete work on all of it. What gets copied is decided in `selection.ts`.
//
// Moving several blocks at once is not supported: a plain click ends the selection.

import * as Blockly from 'blockly';
import { copyStacks, keepInView, offsetStacks } from './selection';
import type { BlockState, WorkspaceState } from './workspace';

/** Set on the SVG group of every block of the selection. */
export const SELECTED_CLASS = 'bc-multi-selected';
export const MARQUEE_CLASS = 'bc-marquee';

/** Each paste lands this far down and right of the previous one (workspace units). */
const PASTE_STEP = 30;

export interface MultiSelect {
  copy(): void;
  cut(): void;
  paste(): void;
  /** Copy and paste in one go. */
  duplicate(): void;
  deleteSelected(): void;
  selectAll(): void;
  clear(): void;
  /** Gives the keyboard back to the workspace (after a click on a button next to it). */
  focus(): void;
  dispose(): void;
}

/**
 * Adds multi-selection to a workspace. `onChange` gets the number of selected blocks whenever it
 * may have changed (also when blocks vanish through undo or through another Slot being loaded).
 */
export function enableMultiSelect(
  ws: Blockly.WorkspaceSvg,
  onChange: (count: number) => void,
): MultiSelect {
  const injection = ws.getInjectionDiv();
  const selected = new Set<string>();
  let buffer: BlockState[] = [];
  let pastes = 0;
  /** Whether the last copy was ours; otherwise Ctrl+V is Blockly's own. */
  let ownClipboard = false;
  let stopMarquee: (() => void) | undefined;

  const allBlocks = () => ws.getAllBlocks(false) as Blockly.BlockSvg[];

  /** Drops vanished blocks, redraws the highlight, tells the owner. */
  function sync(): void {
    for (const id of selected) if (!ws.getBlockById(id)) selected.delete(id);
    for (const block of allBlocks()) {
      block.getSvgRoot().classList.toggle(SELECTED_CLASS, selected.has(block.id));
    }
    onChange(selected.size);
  }

  function select(ids: Iterable<string>): void {
    selected.clear();
    for (const id of ids) selected.add(id);
    sync();
  }

  function clear(): void {
    selected.clear();
    sync();
  }

  function positionOf(id: string): { x: number; y: number } | undefined {
    const xy = ws.getBlockById(id)?.getRelativeToSurfaceXY();
    return xy && { x: xy.x, y: xy.y };
  }

  function copy(): void {
    const state = Blockly.serialization.workspaces.save(ws) as WorkspaceState;
    buffer = copyStacks(state, selected, positionOf);
    pastes = 0;
    ownClipboard = buffer.length > 0;
  }

  function deleteSelected(): void {
    // One undo step for all of it.
    Blockly.Events.setGroup(true);
    try {
      for (const id of [...selected]) {
        const block = ws.getBlockById(id);
        if (!block?.isDeletable()) continue;
        // As Blockly's own delete does: a statement closes the stack up around it, a value block
        // (a Condition) takes its operands along instead of handing them to its parent.
        block.dispose(!block.outputConnection);
      }
    } finally {
      Blockly.Events.setGroup(false);
    }
    clear();
  }

  function paste(): void {
    if (buffer.length === 0) return;
    pastes += 1;
    // Each paste lands a step further down and right of the last; copies of blocks that are out
    // of sight (another Slot, scrolled away) come in the middle of the view instead.
    const view = ws.getMetricsManager().getViewMetrics(true);
    const stacks = offsetStacks(keepInView(buffer, view), pastes * PASTE_STEP, pastes * PASTE_STEP);
    const created: string[] = [];
    Blockly.Events.setGroup(true);
    try {
      for (const stack of stacks) {
        const block = Blockly.serialization.blocks.append(stack, ws, { recordUndo: true });
        created.push(block.id);
      }
    } finally {
      Blockly.Events.setGroup(false);
    }
    select(created);
    // A block Blockly had selected would keep its own highlight next to the pasted ones.
    focusWorkspace();
  }

  /** The block Blockly has selected (a click before the first Shift+click) joins the selection. */
  function seedFromBlockly(): void {
    if (selected.size > 0) return;
    const current = Blockly.common.getSelected();
    if (current instanceof Blockly.BlockSvg && current.workspace === ws) selected.add(current.id);
  }

  /** Keyboard focus goes to the workspace, so the shortcuts below get their key presses. */
  function focusWorkspace(): void {
    Blockly.getFocusManager().focusNode(ws);
  }

  function blockUnder(target: EventTarget | null): Blockly.BlockSvg | undefined {
    const id =
      target instanceof Element ? target.closest('[data-id]')?.getAttribute('data-id') : null;
    // The flyout is a workspace of its own, so its blocks are not found here.
    return (id && ws.getBlockById(id)) || undefined;
  }

  function isBackground(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      (target.classList.contains('blocklyMainBackground') || target === ws.getParentSvg())
    );
  }

  /** Adds the blocks that lie completely inside the frame from `from` to `to` (screen pixels). */
  function addBlocksInFrame(from: Blockly.utils.Coordinate, to: Blockly.utils.Coordinate): void {
    const a = Blockly.utils.svgMath.screenToWsCoordinates(ws, from);
    const b = Blockly.utils.svgMath.screenToWsCoordinates(ws, to);
    const [left, right] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
    const [top, bottom] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    for (const block of allBlocks()) {
      const xy = block.getRelativeToSurfaceXY();
      // A block's own size takes in what is inside it, not the blocks after it, so a frame around
      // the body of an `if` does not take the `if`.
      if (
        xy.x >= left &&
        xy.y >= top &&
        xy.x + block.width <= right &&
        xy.y + block.height <= bottom
      ) {
        selected.add(block.id);
      }
    }
    sync();
  }

  function startMarquee(down: PointerEvent): void {
    stopMarquee?.(); // a second pointer, or an end that never came
    const frame = document.createElement('div');
    frame.className = MARQUEE_CLASS;
    injection.appendChild(frame);
    const origin = injection.getBoundingClientRect();
    const draw = (x: number, y: number) => {
      frame.style.left = `${Math.min(down.clientX, x) - origin.left}px`;
      frame.style.top = `${Math.min(down.clientY, y) - origin.top}px`;
      frame.style.width = `${Math.abs(x - down.clientX)}px`;
      frame.style.height = `${Math.abs(y - down.clientY)}px`;
    };
    const move = (e: PointerEvent) => draw(e.clientX, e.clientY);
    const stop = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', stop);
      frame.remove();
      stopMarquee = undefined;
    };
    const up = (e: PointerEvent) => {
      stop();
      addBlocksInFrame(
        new Blockly.utils.Coordinate(down.clientX, down.clientY),
        new Blockly.utils.Coordinate(e.clientX, e.clientY),
      );
    };
    draw(down.clientX, down.clientY);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', stop);
    stopMarquee = stop;
  }

  // Capture phase: Shift+click must not reach Blockly, whose gesture would move the block or pan.
  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const under = blockUnder(e.target);
    if (!under && !isBackground(e.target)) return; // toolbox, flyout, scrollbars, zoom buttons
    if (!e.shiftKey) {
      // Blockly takes the click (select one block, move it, pan): the extra selection ends.
      if (selected.size > 0) clear();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    ws.hideChaff(); // Blockly's gesture would have closed dropdowns, menus and field editors
    seedFromBlockly();
    focusWorkspace();
    if (under) {
      if (!selected.delete(under.id)) selected.add(under.id);
      sync();
    } else {
      startMarquee(e);
    }
  }

  function isTyping(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (isTyping(e.target) || ws.isDragging()) return;
    // Exact modifiers, like Blockly's own shortcuts: Ctrl+Shift+C is the inspector, AltGr is Ctrl+Alt.
    const command = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
    const bare = !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
    const key = e.key.toLowerCase();
    const take = (action: () => void) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    };
    if (command && key === 'a') return take(selectAll);
    if (command && key === 'v' && ownClipboard) return take(paste);
    if (selected.size === 0) {
      // Blockly copies a single block itself; a paste after that is Blockly's too.
      if (command && (key === 'c' || key === 'x')) ownClipboard = false;
      return;
    }
    if (command && key === 'c') return take(copy);
    if (command && key === 'x') return take(cut);
    if (bare && (key === 'delete' || key === 'backspace')) return take(deleteSelected);
    if (bare && key === 'escape') clear();
  }

  function cut(): void {
    copy();
    deleteSelected();
  }

  function selectAll(): void {
    select(allBlocks().map((block) => block.id));
    focusWorkspace();
  }

  const onWorkspaceEvent = (e: Blockly.Events.Abstract) => {
    // Blocks may vanish (undo, delete) under a selection; nothing to redraw without one.
    if (!e.isUiEvent && selected.size > 0) sync();
  };
  injection.addEventListener('pointerdown', onPointerDown, true);
  injection.addEventListener('keydown', onKeyDown, true);
  ws.addChangeListener(onWorkspaceEvent);

  return {
    copy,
    cut,
    paste,
    duplicate() {
      copy();
      paste();
    },
    deleteSelected,
    selectAll,
    clear,
    focus: focusWorkspace,
    dispose() {
      stopMarquee?.();
      injection.removeEventListener('pointerdown', onPointerDown, true);
      injection.removeEventListener('keydown', onKeyDown, true);
      ws.removeChangeListener(onWorkspaceEvent);
      for (const block of allBlocks()) block.getSvgRoot().classList.remove(SELECTED_CLASS);
    },
  };
}
