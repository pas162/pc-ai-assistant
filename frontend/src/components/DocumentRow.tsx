import { FileText } from "lucide-react";
import type { Document } from "../api";

interface DocumentRowProps {
  doc: Document;
  depth: number;
  onDelete: (doc: Document) => void;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":  return "bg-green-900 text-green-300";
    case "processing": return "bg-blue-900 text-blue-300";
    case "failed":     return "bg-red-900 text-red-300";
    default:           return "bg-yellow-900 text-yellow-300";
  }
}

export default function DocumentRow({ doc, depth, onDelete }: DocumentRowProps) {
  // WHY depth * 16px? Each nesting level indents by 16px.
  // depth=0 → root doc, depth=1 → inside one folder, etc.
  const indentPx = depth * 16 + 8;

  return (
    <div
      className="flex items-center justify-between px-3 py-2 
                 hover:bg-gray-800 transition-colors group border-b 
                 border-gray-700/50 last:border-0"
    >
      {/* Left — icon + filename */}
      <div
        className="flex items-center gap-2 min-w-0"
        style={{ paddingLeft: `${indentPx}px` }}
      >
        <FileText size={13} className="text-gray-500 shrink-0" />
        <span
          className="text-sm text-gray-300 truncate"
          title={doc.filename}
        >
          {doc.filename}
        </span>
        <span className="text-xs text-gray-600 uppercase shrink-0">
          {doc.file_type}
        </span>
      </div>

      {/* Right — status + delete */}
      <div className="flex items-center gap-3 shrink-0 ml-2">
        {doc.status === "processing" ? (
          <div className="flex items-center gap-2 w-32">
            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${doc.progress ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-8 text-right">
              {doc.progress ?? 0}%
            </span>
          </div>
        ) : (
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full 
                           ${getStatusBadgeClass(doc.status)}`}>
            {doc.status}
          </span>
        )}

        <button
          onClick={() => onDelete(doc)}
          className="text-red-400 hover:text-red-300 text-xs font-medium 
                     transition-colors opacity-0 group-hover:opacity-100"
        >
          {doc.status === "pending" || doc.status === "processing"
            ? "Cancel" : "Delete"}
        </button>
      </div>
    </div>
  );
}