import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return createPortal(<dialog className="floating-dialog" ref={ref} aria-label={title}
    onCancel={(event) => event.preventDefault()}>
    <header className="modal-heading"><h2>{title}</h2><button className="icon-only" title="关闭" aria-label="关闭" onClick={onClose}><X size={22} /></button></header>
    {children}
  </dialog>, document.body);
}
