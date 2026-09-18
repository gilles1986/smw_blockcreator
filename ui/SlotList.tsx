import { useState } from 'react';
import { cornerFollowsTop, slotFilled, type BlockModel, type SlotId } from '../core/model';
import { GROUPS, SLOT_LABELS } from './slots';

interface Props {
  model: BlockModel;
  selected: SlotId;
  onSelect: (slot: SlotId) => void;
}

/** Slot rows grouped under Mario and Sprite, with a filled dot per row (variant C). */
export function SlotList({ model, selected, onSelect }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const row = (slot: SlotId) => {
    const filled = slotFilled(model, slot);
    const linked = slot === 'marioTopCorner' && cornerFollowsTop(model);
    return (
      <button
        key={slot}
        type="button"
        className={`slot-row${slot === selected ? ' selected' : ''}${filled ? ' filled' : ''}${linked ? ' linked' : ''}`}
        aria-pressed={slot === selected}
        onClick={() => onSelect(slot)}
      >
        <span className="dot" aria-label={filled ? 'has logic' : 'empty'} />
        <span className="name">{SLOT_LABELS[slot]}</span>
        {linked && <span className="summary">= Top</span>}
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
