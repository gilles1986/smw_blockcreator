import { confirm } from '@tauri-apps/plugin-dialog';
import { useEffect, useState } from 'react';
import { getPiecesLocation, setPiecesLocation, type PiecesLocation } from '../settings';
import { switchPiecesLocation, userPiecesDir, userPiecesWritable } from '../userLibrary';

const PLACES: PiecesLocation[] = ['appData', 'exe'];

const CHOICES: Record<PiecesLocation, { title: string; where: string; help: string }> = {
  appData: {
    title: 'In the app data folder',
    where: 'in the app data folder',
    help: 'Where they have always been. Works wherever BlockCreator.exe is.',
  },
  exe: {
    title: 'Next to BlockCreator.exe',
    where: 'next to BlockCreator.exe',
    help: 'The Pieces travel with the program: copy the whole folder and they come along. Needs a folder you may write to.',
  },
};

export type PickerStatus = { kind: 'info' | 'error' | 'success'; text: string };

interface Props {
  /** True while something else in the dialog is busy. */
  disabled: boolean;
  /** Called once the place has changed, to read the Pieces again. */
  onChanged: () => Promise<void>;
  onStatus: (status: PickerStatus) => void;
}

/** Where the user's own Pieces are kept: the app data folder, or next to BlockCreator.exe. */
export function PiecesLocationPicker({ disabled, onChanged, onStatus }: Props) {
  const [location, setLocation] = useState(getPiecesLocation);
  const [busy, setBusy] = useState(false);
  const [dirs, setDirs] = useState<Partial<Record<PiecesLocation, string>>>({});
  const [writable, setWritable] = useState<Partial<Record<PiecesLocation, boolean>>>({});

  useEffect(() => {
    let current = true;
    for (const place of PLACES) {
      userPiecesDir(place).then(
        (dir) => current && setDirs((all) => ({ ...all, [place]: dir })),
        () => undefined,
      );
      userPiecesWritable(place).then(
        (ok) => current && setWritable((all) => ({ ...all, [place]: ok })),
        () => undefined,
      );
    }
    return () => {
      current = false;
    };
  }, []);

  async function choose(next: PiecesLocation) {
    const previous = location;
    if (next === previous) return;
    if (writable[next] === false) {
      onStatus({
        kind: 'error',
        text: `BlockCreator cannot write ${CHOICES[next].where} (${dirs[next] ?? '?'}). Keep BlockCreator in a folder you own, like your Documents, to use this.`,
      });
      return;
    }
    setBusy(true);
    try {
      const result = await switchPiecesLocation(next, previous, (count, from, to) =>
        confirm(
          `Copy your ${count} Piece${count === 1 ? '' : 's'} to the new place?\n\nFrom: ${from}\nTo: ${to}\n\nThey stay in the old place too.`,
          { title: 'BlockCreator', kind: 'info' },
        ),
      );
      setPiecesLocation(next);
      setLocation(next);
      await onChanged();
      const now = `Your Pieces are now kept ${CHOICES[next].where}.`;
      if (result.copied > 0) {
        onStatus({
          kind: 'success',
          text: `${now} Copied ${result.copied} Piece${result.copied === 1 ? '' : 's'}; the old ones are still in the old place.`,
        });
      } else if (result.alreadyThere > 0) {
        onStatus({
          kind: 'info',
          text: `${now} Found ${result.alreadyThere} there. Those in the old place stay where they are.`,
        });
      } else {
        onStatus({ kind: 'success', text: now });
      }
    } catch (error) {
      onStatus({
        kind: 'error',
        text: `Could not change the place of your Pieces: ${String(error)}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="location-picker">
      <summary>Your Pieces are kept {CHOICES[location].where}</summary>
      <fieldset className="flags-group" disabled={disabled || busy}>
        <legend className="flags-title">Where should your Pieces be kept?</legend>
        <div className="choice-list">
          {PLACES.map((place) => (
            <label key={place} className="choice">
              <input
                type="radio"
                name="pieces-location"
                checked={location === place}
                onChange={() => void choose(place)}
              />
              <span>
                <strong>{CHOICES[place].title}</strong>
                <span className="choice-help">{CHOICES[place].help}</span>
                {dirs[place] && <code className="choice-path">{dirs[place]}</code>}
                {writable[place] === false && (
                  <span className="folder-bad">BlockCreator cannot write there.</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </details>
  );
}
