import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  /** Called when the dialog closes, also through Esc, a click outside or a `method="dialog"` form. */
  onClose: () => void;
  /** Id of the heading inside, for screen readers. */
  titleId: string;
  /** Only rendered while open, so the content starts fresh each time. */
  children: ReactNode;
}

/** A modal dialog on the browser's own `<dialog>`: focus stays inside, Esc closes it. */
export function Modal({ open, onClose, titleId, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      // The dialog has no padding of its own, so a click on it itself is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {open && children}
    </dialog>
  );
}
