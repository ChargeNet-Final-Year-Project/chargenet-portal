// Module-level dispatch lets helpers show a toast without prop threading.
import { ReactNode, useCallback, useEffect, useState } from 'react';

type ToastKind = '' | 'ok' | 'error';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

let pushToast: ((message: string, kind?: ToastKind) => void) | null = null;

export function toast(message: string, kind: ToastKind = ''): void {
  pushToast?.(message, kind);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    pushToast = (message, kind = '') => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => remove(id), kind === 'error' ? 6000 : 3800);
    };
    return () => {
      pushToast = null;
    };
  }, [remove]);

  return (
    <>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.kind}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
