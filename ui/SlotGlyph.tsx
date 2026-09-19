import type { Glyph } from './slots';

/** Degrees that turn the "from the left" drawing into the other sides (SVG turns clockwise). */
const SIDE_TURN = { left: 0, top: 90, right: 180, bottom: 270 } as const;

/** The block in the middle of a 24×24 drawing; what touches it comes from the outside. */
function marks(glyph: Glyph) {
  switch (glyph.kind) {
    case 'side':
      return (
        <g transform={`rotate(${SIDE_TURN[glyph.side]} 12 12)`}>
          <path className="hit" d="M8 8V16" />
          <path className="mover" d="M1 12H6M4 10L6 12L4 14" />
        </g>
      );
    case 'inside': {
      const dot = { whole: [12, 12, 2.4], head: [12, 10, 1.6], body: [12, 14, 1.6] }[glyph.part];
      return <circle className="fill" cx={dot[0]} cy={dot[1]} r={dot[2]} />;
    }
    case 'corner':
      return (
        <>
          <path className="hit" d="M8 11V8H11M13 8H16V11" />
          <path className="mover" d="M2 2L6.5 6.5M3.5 6.5H6.5V3.5" />
        </>
      );
    case 'cape':
      return (
        <>
          <path className="mover" d="M3 14A9 9 0 0 1 21 14" />
          <path className="head" d="M21 16.5L18.5 12.5H23.5Z" />
        </>
      );
    case 'fireball':
      return (
        <>
          <path className="hit" d="M8 8V16" />
          <circle className="head" cx="4" cy="12" r="2.4" />
        </>
      );
    case 'wall':
      return (
        <>
          <path className="hit" d="M8 8V16" />
          <path className="mover" d="M5 19V7M3 9L5 7L7 9" />
        </>
      );
  }
}

/** A small picture of a block with the touched side marked, so a Slot's meaning is visible. */
export function SlotGlyph({ glyph, size = 22 }: { glyph: Glyph; size?: number }) {
  return (
    <svg
      className="glyph"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect className="block" x="8" y="8" width="8" height="8" rx="1" />
      {marks(glyph)}
    </svg>
  );
}
