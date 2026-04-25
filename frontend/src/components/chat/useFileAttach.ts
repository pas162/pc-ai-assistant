import { useState, useRef, useCallback } from "react";
import { ALLOWED_ATTACH_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "./types";
import type { AttachedFile } from "./types";
import type { ToastType } from "../../hooks/useToast";

interface UseFileAttachProps {
  showToast: (message: string, type: ToastType) => void;
}

export function useFileAttach({ showToast }: UseFileAttachProps) {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAttach = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";

      files.forEach((file) => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_ATTACH_EXTENSIONS.includes(ext)) {
          showToast(`"${file.name}" is not a supported file type.`, "error");
          return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          showToast(`"${file.name}" exceeds the 500KB limit.`, "error");
          return;
        }

        if (attachedFiles.some((f) => f.filename === file.name)) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setAttachedFiles((prev) => [
            ...prev,
            { filename: file.name, content },
          ]);
        };
        reader.readAsText(file, "utf-8");
      });
    },
    [attachedFiles, showToast],
  );

  const removeAttachedFile = useCallback(
    (filename: string) =>
      setAttachedFiles((prev) => prev.filter((f) => f.filename !== filename)),
    [],
  );

  const clearAttachedFiles = useCallback(() => setAttachedFiles([]), []);
  return {
    attachedFiles,
    fileInputRef,
    handleFileAttach,
    removeAttachedFile,
    clearAttachedFiles,
  };
}
