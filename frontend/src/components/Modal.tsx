import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={onClose}
    >
      <div
        className={`bg-gray-900 rounded-lg shadow-xl w-full ${maxWidth} mx-4 p-6 border border-gray-700`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-100 text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-gray-800"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal title="Confirm" onClose={onCancel}>
      <p className="text-gray-300 text-sm mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-400 border border-gray-600
                     rounded hover:bg-gray-800 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm text-white rounded transition-colors
                      ${danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
