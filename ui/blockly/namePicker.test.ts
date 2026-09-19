// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { BUILT_IN_NAMES, nameChoices } from '../../core/names';
import { createNamePicker } from './namePicker';

const choices = nameChoices(BUILT_IN_NAMES.sprites(false));

function picker(current: string | null = '04') {
  const onPick = vi.fn();
  const onCancel = vi.fn();
  const { element } = createNamePicker(choices, current, { onPick, onCancel });
  const box = element.querySelector('input')!;
  const options = () => [...element.querySelectorAll<HTMLElement>('.bc-name-option')];
  const type = (text: string) => {
    box.value = text;
    box.dispatchEvent(new Event('input'));
  };
  const press = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    box.dispatchEvent(event);
    return event;
  };
  const highlighted = () => element.querySelector<HTMLElement>('.highlighted')?.dataset.value;
  return { element, box, onPick, onCancel, options, type, press, highlighted };
}

describe('createNamePicker', () => {
  it('lists every number, the named ones first, and starts at the current one', () => {
    const { options, highlighted } = picker('04');
    expect(options()).toHaveLength(256);
    expect(options()[0]?.textContent).toBe('00 · Green Koopa, no shell');
    expect(
      options()
        .find((o) => o.dataset.value === '04')
        ?.classList.contains('current'),
    ).toBe(true);
    expect(highlighted()).toBe('04');
  });

  it('picks a typed number with Enter', () => {
    const { type, press, onPick, options } = picker();
    type('da');
    expect(options()[0]?.textContent).toBe('DA · Green Koopa shell');
    press('Enter');
    expect(onPick).toHaveBeenCalledExactlyOnceWith('DA');
  });

  it('filters by name, and Enter takes the best match', () => {
    const { type, press, onPick, options } = picker();
    type('koopa shell');
    expect(options().map((o) => o.dataset.value)).toEqual(['DA', 'DB', 'DC', 'DD']);
    press('Enter');
    expect(onPick).toHaveBeenCalledWith('DA');
  });

  it('moves with the arrow keys, and stays inside the list', () => {
    const { type, press, onPick, highlighted } = picker();
    type('koopa shell');
    press('ArrowDown');
    press('ArrowDown');
    expect(highlighted()).toBe('DC');
    press('ArrowUp');
    press('ArrowUp');
    press('ArrowUp');
    expect(highlighted()).toBe('DA');
    press('End');
    press('ArrowDown');
    press('PageDown');
    press('PageDown');
    expect(highlighted()).toBe('DD');
    press('Enter');
    expect(onPick).toHaveBeenCalledWith('DD');
  });

  it('picks the option that is clicked', () => {
    const { options, onPick } = picker();
    options()
      .find((o) => o.dataset.value === 'DB')!
      .click();
    expect(onPick).toHaveBeenCalledExactlyOnceWith('DB');
  });

  it('says so when nothing matches, and Enter then picks nothing', () => {
    const { element, type, press, onPick } = picker();
    type('no such sprite');
    expect(element.querySelector('.bc-name-none')?.textContent).toBe('Nothing found');
    press('Enter');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('cancels with Escape', () => {
    const { press, onCancel } = picker();
    press('Escape');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps typing away from the editor around it', () => {
    const { element, press } = picker();
    const outside = vi.fn();
    element.addEventListener('keydown', outside);
    press('Backspace');
    press('a');
    press('Enter');
    expect(outside).not.toHaveBeenCalled();
  });
});
