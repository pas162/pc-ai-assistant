import type { Toast, ToastType } from "../hooks/useToast";

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center justify-between gap-3 px-4 py-3 
            rounded-lg shadow-lg text-white text-sm min-w-64 max-w-sm
            ${
              toast.type === "success"
                ? "bg-green-600"
                : toast.type === "error"
                  ? "bg-red-600"
                  : "bg-gray-700"
            }`}
        >
          <div className="flex items-center gap-2">
            <span>
              {toast.type === "success"
                ? "✅"
                : toast.type === "error"
                  ? "❌"
                  : "ℹ️"}
            </span>
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-white opacity-70 hover:opacity-100 font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// Re-export ToastType so other components can import it from here
// instead of directly from hooks/useToast
export type { ToastType };
