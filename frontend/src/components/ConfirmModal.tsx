import { useEffect, useRef, useState } from 'react';

interface Props {
  title: string;
  body: string;
  confirmLabel?: string;
  confirmPhrase?: string;   // if set, user must type this to enable confirm
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  confirmPhrase,
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  const canConfirm = !confirmPhrase || typed === confirmPhrase;

  return (
    <dialog ref={dialogRef} onCancel={handleClose} style={{ minHeight: 0 }}>
      <form
        method="dialog"
        onSubmit={e => { e.preventDefault(); if (canConfirm) { onConfirm(); handleClose(); } }}
      >
        <header>
          <h2>{title}</h2>
        </header>

        <div>
          <p style={{ margin: '0 0 1rem', color: 'var(--muted-foreground)', fontSize: 'var(--text-7)', lineHeight: 1.6 }}>
            {body}
          </p>

          {confirmPhrase && (
            <div data-field>
              <label htmlFor="confirm-phrase">
                Type <strong style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono, monospace)' }}>"{confirmPhrase}"</strong> to confirm
                <input
                  id="confirm-phrase"
                  type="text"
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={confirmPhrase}
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                />
              </label>
            </div>
          )}
        </div>

        <footer>
          <button type="button" className="outline" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="submit"
            data-variant={danger ? 'danger' : undefined}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
