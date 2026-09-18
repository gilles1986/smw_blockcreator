/** 32-bit FNV-1a over the UTF-8 bytes of `text`, as 8 lower-case hex digits. Detects hand edits. */
export function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
