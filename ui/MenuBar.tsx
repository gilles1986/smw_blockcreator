import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import {
  ImportIcon,
  InfoIcon,
  NewIcon,
  OpenIcon,
  PiecesIcon,
  PresetIcon,
  ProjectIcon,
  SaveAsIcon,
  SaveIcon,
  SettingsIcon,
} from './icons';

interface Props {
  version: string;
  filePath?: string;
  unsavedChanges: boolean;
  desktopFilesSupported: boolean;
  checking: boolean;
  onNew: () => void;
  onOpen: () => void;
  onImport?: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSaveToProject: () => void;
  onOpenPresets: () => void;
  onOpenPieces: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

type MenuId = 'file' | 'pieces' | 'project' | 'help';

interface MenuEntryProps {
  icon: ReactNode;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}

function MenuEntry({ icon, label, hint, disabled, onClick }: MenuEntryProps) {
  return (
    <button
      type="button"
      className="menu-entry"
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
    >
      <span className="entry-icon">{icon}</span>
      <span className="entry-label">{label}</span>
      {hint && <span className="entry-hint">{hint}</span>}
    </button>
  );
}

export function MenuBar({
  version,
  filePath,
  unsavedChanges,
  desktopFilesSupported,
  checking,
  onNew,
  onOpen,
  onImport,
  onSave,
  onSaveAs,
  onSaveToProject,
  onOpenPresets,
  onOpenPieces,
  onOpenSettings,
  onOpenAbout,
}: Props) {
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const displayVersion = version.startsWith('v') ? version : `v${version}`;

  // Close when clicking outside
  useEffect(() => {
    if (!activeMenu) return;
    function handleClickOutside(event: MouseEvent) {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setActiveMenu(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  const handleMenuClick = (id: MenuId) => {
    setActiveMenu(activeMenu === id ? null : id);
  };

  const handleMenuHover = (id: MenuId) => {
    if (activeMenu !== null) {
      setActiveMenu(id);
    }
  };

  const runAction = (action: () => void) => {
    setActiveMenu(null);
    action();
  };

  // Derive simple file name for the right-side badge
  const displayFileName = filePath
    ? filePath.replace(/\\/g, '/').split('/').pop()
    : 'Untitled Block';

  return (
    <header className="menu-bar" ref={barRef} role="menubar">
      {/* Brand & Version Badge */}
      <div className="menu-brand">
        {!isTauri() ? (
          <a
            href="https://saphros.de/block-creator"
            className="brand-name"
            title="Back to the Block Creator page on saphros.de"
          >
            ← Saphros BlockCreator
          </a>
        ) : (
          <span className="brand-name">BlockCreator</span>
        )}
        <span className="brand-version">{displayVersion}</span>
      </div>

      {/* Level 1: Menu Titles */}
      <nav className="menu-nav">
        {/* FILE MENU */}
        <div className="menu-group">
          <button
            type="button"
            className={`menu-tab ${activeMenu === 'file' ? 'open' : ''}`}
            onClick={() => handleMenuClick('file')}
            onMouseEnter={() => handleMenuHover('file')}
            aria-haspopup="true"
            aria-expanded={activeMenu === 'file'}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="menu-dropdown" role="menu">
              <MenuEntry
                icon={<NewIcon />}
                label="New Block"
                hint="Blank"
                onClick={() => runAction(onNew)}
              />
              <MenuEntry
                icon={<OpenIcon />}
                label="Open Block…"
                hint={desktopFilesSupported ? 'Ctrl+O' : undefined}
                onClick={() => runAction(onOpen)}
              />
              {onImport && (
                <MenuEntry
                  icon={<ImportIcon />}
                  label="Import ASM / Text…"
                  hint="Paste"
                  onClick={() => runAction(onImport)}
                />
              )}
              <div className="menu-divider" />
              <MenuEntry
                icon={<SaveIcon />}
                label="Save"
                hint={desktopFilesSupported ? 'Ctrl+S' : 'Download'}
                disabled={checking}
                onClick={() => runAction(onSave)}
              />
              <MenuEntry
                icon={<SaveAsIcon />}
                label="Save As…"
                hint={desktopFilesSupported ? undefined : 'Download'}
                disabled={checking}
                onClick={() => runAction(onSaveAs)}
              />
            </div>
          )}
        </div>

        {/* PIECES MENU */}
        <div className="menu-group">
          <button
            type="button"
            className={`menu-tab ${activeMenu === 'pieces' ? 'open' : ''}`}
            onClick={() => handleMenuClick('pieces')}
            onMouseEnter={() => handleMenuHover('pieces')}
            aria-haspopup="true"
            aria-expanded={activeMenu === 'pieces'}
          >
            Pieces
          </button>
          {activeMenu === 'pieces' && (
            <div className="menu-dropdown" role="menu">
              <MenuEntry
                icon={<PiecesIcon />}
                label="Custom Pieces (Creator, Import, Export)…"
                hint={desktopFilesSupported ? '' : '(desktop only)'}
                disabled={!desktopFilesSupported}
                onClick={() => runAction(onOpenPieces)}
              />
              <MenuEntry
                icon={<PresetIcon />}
                label="New from Preset…"
                hint="Munchers, etc."
                onClick={() => runAction(onOpenPresets)}
              />
            </div>
          )}
        </div>

        {/* PROJECT MENU */}
        <div className="menu-group">
          <button
            type="button"
            className={`menu-tab ${activeMenu === 'project' ? 'open' : ''}`}
            onClick={() => handleMenuClick('project')}
            onMouseEnter={() => handleMenuHover('project')}
            aria-haspopup="true"
            aria-expanded={activeMenu === 'project'}
          >
            Project
          </button>
          {activeMenu === 'project' && (
            <div className="menu-dropdown" role="menu">
              <MenuEntry
                icon={<ProjectIcon />}
                label="Save to GPS Project…"
                hint={desktopFilesSupported ? '' : '(desktop only)'}
                disabled={!desktopFilesSupported || checking}
                onClick={() => runAction(onSaveToProject)}
              />
              <div className="menu-divider" />
              <MenuEntry
                icon={<SettingsIcon />}
                label="Project Settings (GPS & PIXI)…"
                hint={desktopFilesSupported ? '' : '(desktop only)'}
                disabled={!desktopFilesSupported}
                onClick={() => runAction(onOpenSettings)}
              />
            </div>
          )}
        </div>

        {/* HELP MENU */}
        <div className="menu-group">
          <button
            type="button"
            className={`menu-tab ${activeMenu === 'help' ? 'open' : ''}`}
            onClick={() => handleMenuClick('help')}
            onMouseEnter={() => handleMenuHover('help')}
            aria-haspopup="true"
            aria-expanded={activeMenu === 'help'}
          >
            Help
          </button>
          {activeMenu === 'help' && (
            <div className="menu-dropdown" role="menu">
              <MenuEntry
                icon={<InfoIcon />}
                label="About BlockCreator"
                hint={displayVersion}
                onClick={() => runAction(onOpenAbout)}
              />
            </div>
          )}
        </div>
      </nav>

      {/* Right side status / file label */}
      <div className="menu-status">
        <span
          className={`file-indicator ${unsavedChanges ? 'unsaved' : ''}`}
          title={filePath ?? 'Untitled Block'}
        >
          {displayFileName}
          {unsavedChanges && ' • (unsaved)'}
        </span>
      </div>
    </header>
  );
}
