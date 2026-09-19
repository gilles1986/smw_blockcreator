import { useEffect, useRef, useState } from 'react';
import {
  cornerFollowsTop,
  effectiveSlot,
  slotFilled,
  slotKind,
  slotLinkTarget,
  SLOT_IDS,
  type BlockModel,
  type SlotId,
} from '../core/model';
import marioHead from './assets/mario_head.png';
import shell from './assets/shell.png';
import { SlotGlyph } from './SlotGlyph';
import { GROUPS, SLOT_GLYPHS, SLOT_HINTS, SLOT_LABELS, type GroupName } from './slots';

/** The picture in front of each group's heading. */
const GROUP_ICONS: Record<GroupName, string> = { Mario: marioHead, Sprite: shell };

interface Props {
  model: BlockModel;
  selected: SlotId;
  onSelect: (slot: SlotId) => void;
  /** Sets or clears a "same logic as" link for a Slot. */
  onLink: (slot: SlotId, target: SlotId | undefined) => void;
  /** Slots the last Asar check found errors in. */
  errorSlots?: ReadonlySet<SlotId>;
}

/** Slot rows grouped under Mario and Sprite, with a filled dot and a link control per row. */
export function SlotList({ model, selected, onSelect, onLink, errorSlots }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [linkMenuFor, setLinkMenuFor] = useState<SlotId | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!linkMenuFor) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setLinkMenuFor(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLinkMenuFor(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [linkMenuFor]);

  /** Slots this Slot may link to: same kind, not itself, and not already linked back here. */
  const linkTargets = (slot: SlotId) =>
    SLOT_IDS.filter(
      (other) =>
        other !== slot &&
        slotKind(other) === slotKind(slot) &&
        slotLinkTarget(model, other) !== slot,
    );

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
      <div
        key={slot}
        className={`slot-row${slot === selected ? ' selected' : ''}${filled ? ' filled' : ''}${linked ? ' linked' : ''}${hasError ? ' has-error' : ''}`}
      >
        <button
          type="button"
          className="slot-pick"
          aria-pressed={slot === selected}
          title={SLOT_HINTS[slot]}
          onClick={() => onSelect(slot)}
        >
          <span className="dot" aria-label={filled ? 'has logic' : 'empty'} />
          <SlotGlyph glyph={SLOT_GLYPHS[slot]} />
          <span className="name">{SLOT_LABELS[slot]}</span>
          {summary && <span className="summary">{summary}</span>}
        </button>
        <button
          type="button"
          className={`link-btn${linkTarget ? ' active' : ''}`}
          aria-label={
            linkTarget
              ? `Uses ${SLOT_LABELS[linkTarget]}'s logic; change link`
              : 'Share logic with another slot'
          }
          aria-expanded={linkMenuFor === slot}
          onClick={() => setLinkMenuFor(linkMenuFor === slot ? null : slot)}
        >
          🔗
        </button>
        {linkMenuFor === slot && (
          <div className="link-menu" role="menu" ref={menuRef}>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!linkTarget}
              className={linkTarget ? '' : 'current'}
              onClick={() => {
                onLink(slot, undefined);
                setLinkMenuFor(null);
              }}
            >
              Individual
            </button>
            {linkTargets(slot).map((target) => (
              <button
                key={target}
                type="button"
                role="menuitemradio"
                aria-checked={linkTarget === target}
                className={linkTarget === target ? 'current' : ''}
                onClick={() => {
                  onLink(slot, target);
                  setLinkMenuFor(null);
                }}
              >
                Same as {SLOT_LABELS[target]}
              </button>
            ))}
          </div>
        )}
      </div>
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
            <h2 className="group">
              <img className="group-icon" src={GROUP_ICONS[group.name]} alt="" />
              {group.name}
            </h2>
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
