import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  subtitle?: ReactNode;
}

export function Modal({ title, subtitle, onClose, children, footer, size = 'md' }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select');
    (target ?? panel.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Only the topmost modal handles Escape.
      const modals = document.querySelectorAll('.modal-panel');
      if (modals[modals.length - 1] === panel.current) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      requestAnimationFrame(() => {
        if (!document.querySelector('.modal-panel')) document.body.classList.remove('modal-open');
      });
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-panel modal-${size}`} role="dialog" aria-modal="true" ref={panel} tabIndex={-1}>
        <header className="modal-header">
          <div className="modal-titles">
            <h2>{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            data-autofocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}

interface TextInputDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

export function TextInputDialog({ title, label, initialValue = '', submitLabel = 'Save', onSubmit, onClose }: TextInputDialogProps) {
  const input = useRef<HTMLInputElement>(null);
  const error = useRef<HTMLParagraphElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.current?.value.trim() ?? '';
    if (!value) return;
    try {
      await onSubmit(value);
      onClose();
    } catch (err) {
      if (error.current) error.current.textContent = err instanceof Error ? err.message : String(err);
    }
  };

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span className="field-label">{label}</span>
          <input ref={input} className="input" defaultValue={initialValue} maxLength={60} />
        </label>
        <p className="form-error" ref={error} role="alert" />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
