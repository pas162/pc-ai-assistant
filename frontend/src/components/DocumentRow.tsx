import { FileText } from "lucide-react";
import type { Document } from "../api";

interface DocumentRowProps {
  doc: Document;
  depth: number;
  onDelete: (doc: Document) => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-900 text-green-300";
    case "processing":
      return "bg-blue-900 text-blue-300";
    case "failed":
      return "bg-red-900 text-red-300";
    default:
      return "bg-yellow-900 text-yellow-300";
  }
}

function getFileTypeColor(fileType: string | null): string {
  switch (fileType) {
    case "pdf":
      return "text-red-400";
    case "docx":
      return "text-blue-400";
    case "xlsx":
      return "text-green-400";
    case "java":
      return "text-orange-400";
    case "py":
      return "text-yellow-400";
    case "ts":
    case "js":
      return "text-cyan-400";
    case "xml":
    case "mdf":
      return "text-purple-400";
    case "md":
      return "text-gray-300";
    default:
      return "text-gray-500";
  }
}

export default function DocumentRow({
  doc,
  depth,
  onDelete,
}: DocumentRowProps) {
  const indentPx = depth * 16 + 8;

  return (
    <div
      className="flex items-center justify-between px-3 py-2
                 hover:bg-gray-800 transition-colors group border-b
                 border-gray-700/50 last:border-0"
    >
      {/* Left — filename (takes remaining space) */}
      <div
        className="flex items-center gap-2 min-w-0 flex-1"
        style={{ paddingLeft: `${indentPx}px` }}
      >
        <FileText size={13} className="text-gray-500 shrink-0" />
        <span className="text-sm text-gray-300 truncate" title={doc.filename}>
          {doc.filename}
        </span>
      </div>

      {/* Fixed-width columns — always aligned regardless of filename length */}
      <div className="flex items-center shrink-0 ml-2">
        {/* Type — fixed width, right-aligned text */}
        <div className="w-12 text-right">
          <span
            className={`text-xs font-medium uppercase
                           ${getFileTypeColor(doc.file_type)}`}
          >
            {doc.file_type ?? "?"}
          </span>
        </div>

        {/* Size — fixed width, right-aligned text */}
        <div className="w-20 text-right">
          <span className="text-xs text-gray-600">
            {formatFileSize(doc.file_size)}
          </span>
        </div>

        {/* Status — fixed width */}
        <div className="w-28 flex justify-end">
          {doc.status === "processing" ? (
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${doc.progress ?? 0}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-8 text-right shrink-0">
                {doc.progress ?? 0}%
              </span>
            </div>
          ) : (
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-full
                             ${getStatusBadgeClass(doc.status)}`}
            >
              {doc.status}
            </span>
          )}
        </div>

        {/* Delete — fixed width */}
        <div className="w-14 flex justify-end">
          <button
            onClick={() => onDelete(doc)}
            className="text-red-400 hover:text-red-300 text-xs font-medium
                       transition-colors opacity-0 group-hover:opacity-100"
          >
            {doc.status === "pending" || doc.status === "processing"
              ? "Cancel"
              : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
