import { FileText, Trash2, X } from "lucide-react";
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

function getStatusDot(status: string): { dot: string; label: string; text: string } {
  switch (status) {
    case "completed":  return { dot: "bg-green-500",  label: "completed", text: "text-green-400" };
    case "processing": return { dot: "bg-blue-400 animate-pulse", label: "processing", text: "text-blue-400" };
    case "failed":     return { dot: "bg-red-500",    label: "failed",    text: "text-red-400" };
    default:           return { dot: "bg-yellow-500", label: "pending",   text: "text-yellow-400" };
  }
}

function getFileTypeBadge(fileType: string | null): { bg: string; text: string } {
  switch (fileType) {
    case "pdf":  return { bg: "bg-red-500/15",    text: "text-red-400" };
    case "docx": return { bg: "bg-blue-500/15",   text: "text-blue-400" };
    case "xlsx": return { bg: "bg-green-500/15",  text: "text-green-400" };
    case "java": return { bg: "bg-orange-500/15", text: "text-orange-400" };
    case "py":   return { bg: "bg-yellow-500/15", text: "text-yellow-400" };
    case "ts":
    case "js":   return { bg: "bg-cyan-500/15",   text: "text-cyan-400" };
    case "xml":  return { bg: "bg-purple-500/15", text: "text-purple-400" };
    case "md":   return { bg: "bg-gray-500/15",   text: "text-gray-300" };
    default:     return { bg: "bg-gray-700/50",   text: "text-gray-500" };
  }
}

function stripUuidPrefix(filename: string): string {
  return filename.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/, "");
}


export default function DocumentRow({
  doc,
  depth,
  onDelete,
}: DocumentRowProps) {
  const indentPx = depth * 16 + 12;
  const displayName = stripUuidPrefix(doc.filename);
  const { dot, label, text } = getStatusDot(doc.status);
  const typeBadge = getFileTypeBadge(doc.file_type);
  const isProcessing = doc.status === "pending" || doc.status === "processing";

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5
                 hover:bg-gray-800/60 transition-colors group
                 border-b border-gray-800/60 last:border-0"
    >
      {/* File icon */}
      <div style={{ paddingLeft: `${indentPx}px` }} className="shrink-0">
        <FileText size={14} className="text-gray-600" />
      </div>

      {/* Filename — grows */}
      <span className="flex-1 text-sm text-gray-300 truncate min-w-0" title={doc.filename}>
        {displayName}
      </span>

      {/* Type badge */}
      <span className={`shrink-0 text-xs font-semibold uppercase px-1.5 py-0.5
                        rounded ${typeBadge.bg} ${typeBadge.text}`}>
        {doc.file_type ?? "?"}
      </span>

      {/* Size */}
      <span className="w-16 text-right text-xs text-gray-600 shrink-0">
        {formatFileSize(doc.file_size)}
      </span>

      {/* Status */}
      <div className="w-28 flex items-center justify-end shrink-0">
        {doc.status === "processing" ? (
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 bg-gray-700 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all duration-500"
                style={{ width: `${doc.progress ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-blue-400 w-8 text-right shrink-0">
              {doc.progress ?? 0}%
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
            <span className={`text-xs ${text}`}>{label}</span>
          </div>
        )}
      </div>

      {/* Delete button — appears on hover */}
      <div className="w-8 flex justify-end shrink-0">
        <button
          onClick={() => onDelete(doc)}
          title={isProcessing ? "Cancel processing" : "Delete file"}
          className="text-gray-700 hover:text-red-400 transition-colors
                     opacity-0 group-hover:opacity-100"
        >
          {isProcessing ? <X size={14} /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  );
}
