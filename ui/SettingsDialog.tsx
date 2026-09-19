import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { getFolder, setFolder, type FolderSetting } from './settings';
import { gpsFolderOk, pickFolder, pixiFolderOk } from './tauriProject';

interface RowProps {
  setting: FolderSetting;
  label: string;
  /** What the folder is used for. */
  hint: string;
  /** What a folder of this kind has, for the message when it does not. */
  needs: string;
  isRightFolder: (folder: string) => Promise<boolean>;
}

/** One folder setting: the path, whether it is the right kind of folder, and Choose / Clear. */
function FolderRow({ setting, label, hint, needs, isRightFolder }: RowProps) {
  const [folder, setFolderState] = useState(() => getFolder(setting));
  const [verdict, setVerdict] = useState<{ folder: string; right: boolean }>();

  useEffect(() => {
    if (folder === undefined) return;
    let current = true;
    isRightFolder(folder).then(
      (right) => current && setVerdict({ folder, right }),
      () => current && setVerdict({ folder, right: false }),
    );
    return () => {
      current = false;
    };
  }, [folder, isRightFolder]);

  const right = verdict && verdict.folder === folder ? verdict.right : undefined;
  async function choose() {
    const picked = await pickFolder(`Choose the ${label}`);
    if (picked === undefined) return;
    setFolder(setting, picked);
    setFolderState(picked);
  }
  return (
    <div className="folder-row">
      <strong>{label}</strong>
      <span className="hint">{hint}</span>
      <div className="folder-path">
        <span className="path" title={folder}>
          {folder ?? 'Not set'}
        </span>
        <button type="button" onClick={choose}>
          Choose…
        </button>
        <button
          type="button"
          disabled={folder === undefined}
          onClick={() => {
            setFolder(setting, undefined);
            setFolderState(undefined);
          }}
        >
          Clear
        </button>
      </div>
      {right === true && <span className="folder-ok">Found</span>}
      {right === false && (
        <span className="folder-bad">
          Not a {label} (needs {needs})
        </span>
      )}
    </div>
  );
}

/** Where the GPS and PIXI folders of the user's project are. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} titleId="settings-title">
      <div className="modal-body">
        <h2 id="settings-title">Settings</h2>
        <FolderRow
          setting="gpsFolder"
          label="GPS folder"
          hint="Blocks are saved into its blocks folder and checked with its asar.dll."
          needs="asar.dll and defines.asm"
          isRightFolder={gpsFolderOk}
        />
        <FolderRow
          setting="pixiFolder"
          label="PIXI folder"
          hint="Where PIXI and its list.txt are: custom sprites are read from here."
          needs="pixi.exe and list.txt"
          isRightFolder={pixiFolderOk}
        />
        <form method="dialog">
          <button type="submit">Close</button>
        </form>
      </div>
    </Modal>
  );
}
