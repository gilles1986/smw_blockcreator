// The search dropdown of a name field: a text box above a list of numbers, filtered as you type.
// Plain DOM without Blockly, so it can be tested on its own; `NameField` puts it into Blockly's
// dropdown container. Type a name to find it, or a number such as `DA` and press Enter.

import { filterChoices, type NameChoice } from '../../core/names';

export interface NamePicker {
  element: HTMLElement;
  /** Puts the cursor into the search box, with the text selected. */
  focus(): void;
}

interface Callbacks {
  /** A number was chosen, by click or Enter. */
  onPick: (value: string) => void;
  /** Escape was pressed. */
  onCancel: () => void;
}

/** `current` is the number the field holds now: it is marked and is where the list starts. */
export function createNamePicker(
  choices: readonly NameChoice[],
  current: string | null,
  { onPick, onCancel }: Callbacks,
): NamePicker {
  const element = document.createElement('div');
  element.className = 'bc-name-picker';
  const box = document.createElement('input');
  box.type = 'text';
  box.className = 'bc-name-search';
  box.placeholder = 'Search, or type a number such as DA';
  box.spellcheck = false;
  box.autocomplete = 'off';
  box.setAttribute('aria-label', 'Search names or type a number');
  const list = document.createElement('div');
  list.className = 'bc-name-list';
  list.setAttribute('role', 'listbox');
  element.append(box, list);

  let shown: NameChoice[] = [];
  let highlighted = 0;

  const highlight = (index: number) => {
    highlighted = Math.min(Math.max(index, 0), shown.length - 1);
    [...list.children].forEach((child, i) => {
      child.classList.toggle('highlighted', i === highlighted);
      child.setAttribute('aria-selected', String(i === highlighted));
      // Not in every DOM (jsdom has none).
      if (i === highlighted) (child as HTMLElement).scrollIntoView?.({ block: 'nearest' });
    });
  };

  const render = () => {
    shown = filterChoices(choices, box.value);
    list.replaceChildren(
      ...shown.map((choice) => {
        const item = document.createElement('div');
        item.className = 'bc-name-option';
        item.setAttribute('role', 'option');
        item.dataset.value = choice.value;
        item.textContent = choice.label;
        item.classList.toggle('unnamed', !choice.named);
        item.classList.toggle('current', choice.value === current);
        return item;
      }),
    );
    if (shown.length === 0) {
      const none = document.createElement('div');
      none.className = 'bc-name-none';
      none.textContent = 'Nothing found';
      list.append(none);
    }
    // With nothing typed the list starts at the current number; else the best match is on top.
    const start = box.value.trim() === '' ? shown.findIndex((c) => c.value === current) : 0;
    highlight(Math.max(start, 0));
  };

  box.addEventListener('input', render);
  box.addEventListener('keydown', (event) => {
    const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
    if (event.key in step) {
      highlight(highlighted + step[event.key]!);
    } else if (event.key === 'Enter') {
      const choice = shown[highlighted];
      if (choice) onPick(choice.value);
    } else if (event.key === 'Escape') {
      onCancel();
    } else {
      // Typing must not reach Blockly's shortcuts (Delete, Backspace, Ctrl+A, …).
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  list.addEventListener('click', (event) => {
    const value = (event.target as HTMLElement).closest<HTMLElement>('.bc-name-option')?.dataset
      .value;
    if (value !== undefined) onPick(value);
  });

  render();
  return {
    element,
    focus: () => {
      box.focus();
      box.select();
    },
  };
}
