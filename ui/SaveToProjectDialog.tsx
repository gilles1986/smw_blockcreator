import { useEffect, useState } from 'react';
import { entryOf, occupancy, parseList, sameFile, type ListEntry } from '../core/listtxt';
import { formatHex, parseHex } from './hex';
import { Modal } from './Modal';
import { listFile, type ListChoice, type ProjectFiles } from './projectSave';

/** Map16 pages offered for the tile: 00 to 7F. */
const PAGES = Array.from({ length: 0x80 }, (_, page) => page);
const FIRST_PAGE = 0x04;

type Load =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; entries: ListEntry[] };

interface FormProps {
  project: ProjectFiles;
  gpsFolder: string;
  name: string;
  defaultActAs: number;
  /** Saves the Block, and adds it to list.txt when `list` is given. */
  onSave: (list: ListChoice | undefined) => Promise<void>;
  onClose: () => void;
}

function Form({ project, gpsFolder, name, defaultActAs, onSave, onClose }: FormProps) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [addToList, setAddToList] = useState(true);
  const [pageChoice, setPageChoice] = useState<number>();
  const [tileChoice, setTileChoice] = useState<number>();
  const [actAsText, setActAsText] = useState(formatHex(defaultActAs, 3));
  const [saving, setSaving] = useState(false);
  const file = listFile(name);

  useEffect(() => {
    let current = true;
    project.read('list.txt').then(
      (text) =>
        current &&
        setLoad(text === null ? { kind: 'missing' } : { kind: 'ready', entries: parseList(text) }),
      (error) => current && setLoad({ kind: 'failed', message: String(error) }),
    );
    return () => {
      current = false;
    };
  }, [project]);

  const entries = load.kind === 'ready' ? load.entries : [];
  const holders = occupancy(entries);
  const existing = entryOf(entries, file);
  /** Held by another file: the tile is taken. */
  const taken = (tile: number) => {
    const holder = holders.get(tile);
    return holder !== undefined && !sameFile(holder.file, file);
  };
  const page = pageChoice ?? (existing?.tiles[0] ?? FIRST_PAGE << 8) >> 8;
  const firstFree = Array.from({ length: 256 }, (_, i) => (page << 8) | i).find((t) => !taken(t));
  // Once another page is picked, the entry's own tile no longer applies.
  const tile =
    tileChoice ?? (pageChoice === undefined ? existing?.tiles[0] : undefined) ?? firstFree;
  const actAs = parseHex(actAsText);
  const listing = load.kind === 'ready' && addToList;
  const valid =
    !listing || (tile !== undefined && !taken(tile) && actAs !== undefined && actAs <= 0xffff);

  async function save() {
    setSaving(true);
    try {
      await onSave(
        listing && tile !== undefined && actAs !== undefined ? { tile, actAs } : undefined,
      );
    } finally {
      onClose();
    }
  }

  return (
    <div className="modal-body">
      <h2 id="project-title">Save to GPS project</h2>
      <p className="hint">
        <code>{`${gpsFolder}/blocks/${file}`}</code>
      </p>
      {load.kind === 'loading' && <p className="hint">Reading list.txt…</p>}
      {load.kind === 'missing' && (
        <p className="hint">
          This GPS folder has no list.txt; the Block file is saved without a list entry.
        </p>
      )}
      {load.kind === 'failed' && (
        <p className="folder-bad">Could not read list.txt: {load.message}</p>
      )}
      {load.kind === 'ready' && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={addToList}
              onChange={(event) => setAddToList(event.target.checked)}
            />
            {existing ? 'Update its list.txt entry' : 'Add it to list.txt'}
          </label>
          {addToList && (
            <div className="tile-fields">
              <label>
                Map16 page
                <select
                  value={page}
                  onChange={(event) => {
                    setPageChoice(Number(event.target.value));
                    setTileChoice(undefined);
                  }}
                >
                  {PAGES.map((p) => (
                    <option key={p} value={p}>
                      {formatHex(p, 2)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tile
                <select
                  value={tile ?? ''}
                  onChange={(event) => setTileChoice(Number(event.target.value))}
                >
                  {Array.from({ length: 256 }, (_, i) => (page << 8) | i).map((t) => (
                    <option key={t} value={t} disabled={taken(t)}>
                      {formatHex(t, 4)} · {holders.get(t)?.file ?? 'free'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Acts like
                <input value={actAsText} onChange={(event) => setActAsText(event.target.value)} />
              </label>
            </div>
          )}
        </>
      )}
      <div className="modal-actions">
        <button type="button" disabled={saving || !valid || load.kind === 'loading'} onClick={save}>
          Save
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Asks where the Block goes in list.txt, then hands the choice to `onSave`. */
export function SaveToProjectDialog(
  props: Omit<FormProps, 'onClose'> & { open: boolean; onClose: () => void },
) {
  const { open, ...form } = props;
  return (
    <Modal open={open} onClose={props.onClose} titleId="project-title">
      <Form {...form} />
    </Modal>
  );
}
