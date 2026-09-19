import { useState } from 'react';
import {
  cornerFollowsTop,
  effectiveSlot,
  slotFilled,
  slotLinkTarget,
  type BlockModel,
  type SlotId,
} from '../core/model';
import { GROUPS, SLOT_LABELS } from './slots';

interface Props {
  model: BlockModel;
  selected: SlotId;
  onSelect: (slot: SlotId) => void;
  /** Slots the last Asar check found errors in. */
  errorSlots?: ReadonlySet<SlotId>;
}

/** Slot rows grouped under Mario and Sprite, with a filled dot per row (variant C). */
export function SlotList({ model, selected, onSelect, errorSlots }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const row = (slot: SlotId) => {
    const filled = slotFilled(model, slot);
    const hasError = errorSlots?.has(effectiveSlot(model, slot)) ?? false;
    const linkTarget = slotLinkTarget(model, slot);
    const linked =
      (slot === 'marioTopCorner' && cornerFollowsTop(model)) || linkTarget !== undefined;
    const summary =
      slot === 'marioTopCorner' && cornerFollowsTop(model)
        ? '= Top'
        : linkTarget
          ? `= ${SLOT_LABELS[linkTarget]}`
          : undefined;
    return (
      <button
        key={slot}
        type="button"
        className={`slot-row${slot === selected ? ' selected' : ''}${filled ? ' filled' : ''}${linked ? ' linked' : ''}${hasError ? ' has-error' : ''}`}
        aria-pressed={slot === selected}
        onClick={() => onSelect(slot)}
      >
        <span className="dot" aria-label={filled ? 'has logic' : 'empty'} />
        <span className="name">{SLOT_LABELS[slot]}</span>
        {summary && <span className="summary">{summary}</span>}
      </button>
    );
  };
  return (
    <section className="slots" aria-label="Slots">
      {GROUPS.map((group) => {
        const advanced = (group.advanced ?? []).filter(
          (slot) => showAdvanced || slotFilled(model, slot) || slot === selected,
        );
        return (
          <div key={group.name} role="group" aria-label={group.name}>
            <h2 className="group">{group.name}</h2>
            {group.slots.map(row)}
            {advanced.map(row)}
            {group.advanced && (
              <button
                type="button"
                className="advanced-toggle"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((shown) => !shown)}
              >
                {showAdvanced ? 'Hide advanced Slots' : 'Show advanced Slots'}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
