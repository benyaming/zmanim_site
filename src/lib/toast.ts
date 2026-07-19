/**
 * Minimal app-wide toast bus. Non-React module so lib code (e.g. the export
 * pipeline) can announce outcomes; the single <Toaster /> in the app shell
 * subscribes and renders. Messages are i18n *keys* (full path, e.g.
 * 'export.sentToBot') — translation happens in the Toaster, where hooks live.
 */

export interface ToastEvent {
  id: number;
  /** Full next-intl message key, e.g. 'export.sentToBot'. */
  messageKey: string;
}

type Listener = (toast: ToastEvent) => void;

let nextId = 1;
const listeners = new Set<Listener>();

/** Show a small transient message (bottom of the screen, auto-hides). */
export function showToast(messageKey: string): void {
  const toast: ToastEvent = { id: nextId++, messageKey };
  for (const listener of listeners) listener(toast);
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
