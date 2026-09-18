import type { LabelFactory } from './render';

/**
 * Hands out one label factory per Piece instance. Labels look like `bc<n>_<name>`: the same name
 * within an instance gives the same label, different instances never collide (a name cannot start
 * with a digit, so `<n>` is unambiguous). Numbering starts at 1 per allocator, so a fresh allocator
 * per generated Block keeps the output deterministic.
 */
export function createLabelAllocator(): { instance(): LabelFactory } {
  let next = 1;
  return {
    instance() {
      const n = next++;
      return (name) => `bc${n}_${name}`;
    },
  };
}
