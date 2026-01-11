import type { Toast } from "../types";

type ToastsProps = {
  toasts: Toast[];
};

export function Toasts({ toasts }: ToastsProps) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
