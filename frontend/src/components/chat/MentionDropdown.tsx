import { X, FileText, Folder as FolderIcon } from "lucide-react";
import { type RefObject } from "react";
import type { Document } from "../../api";
import type { FolderNode, MentionItem } from "./types";
import { collectDocsUnderFolder } from "./types";

// Re-export MentionItem type so ChatPanel can use it
export type { MentionItem };

interface MentionDropdownProps {
  mentionItems: MentionItem[];
  mentionIndex: number;
  mentionSearch: string;
  mentionedDocs: Document[];
  workspaceDocsCompletedCount: number;
  dropdownRef: RefObject<HTMLDivElement | null>;
  onSearchChange: (val: string) => void;
  onIndexChange: (updater: (i: number) => number) => void;
  onSelectFile: (doc: Document) => void;
  onSelectFolder: (node: FolderNode) => void;
  onClose: () => void;
}

export default function MentionDropdown({
  mentionItems,
  mentionIndex,
  mentionSearch,
  mentionedDocs,
  workspaceDocsCompletedCount,
  dropdownRef,
  onSearchChange,
  onIndexChange,
  onSelectFile,
  onSelectFolder,
  onClose,
}: MentionDropdownProps) {
  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 right-0 mb-1 z-50
                 bg-gray-900 border border-gray-700 rounded-lg
                 shadow-xl overflow-hidden"
    >
      {/* Header: hint + search */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700">
        <span className="text-xs text-gray-600 shrink-0">
          ↑↓ navigate · Enter select · Esc close
        </span>
        <input
          autoFocus
          type="text"
          value={mentionSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              onIndexChange((i) => (i + 1) % Math.max(mentionItems.length, 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onIndexChange(
                (i) =>
                  (i - 1 + Math.max(mentionItems.length, 1)) %
                  Math.max(mentionItems.length, 1),
              );
            }
            if (e.key === "Enter" && mentionItems.length > 0) {
              const item = mentionItems[mentionIndex];
              if (item.type === "file") onSelectFile(item.doc);
              else onSelectFolder(item.node);
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Search files and folders..."
          className="flex-1 bg-transparent text-xs text-gray-300
                     placeholder-gray-600 focus:outline-none py-0.5"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 transition-colors shrink-0"
        >
          <X size={11} />
        </button>
      </div>

      {/* Flat list */}
      <div className="max-h-52 overflow-y-auto custom-scrollbar">
        {mentionItems.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">
            {workspaceDocsCompletedCount === 0
              ? "No completed documents in this workspace"
              : mentionSearch
                ? `No matches for "${mentionSearch}"`
                : "All documents already mentioned"}
          </p>
        ) : (
          mentionItems.map((item, i) =>
            item.type === "file" ? (
              <button
                key={item.doc.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelectFile(item.doc)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center
                  gap-2 transition-colors
                  ${
                    i === mentionIndex
                      ? "bg-blue-600/30 text-blue-300"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
              >
                <FileText size={12} className="text-gray-500 shrink-0" />
                <span className="truncate flex-1">{item.doc.filename}</span>
                <span className="text-gray-600 uppercase text-xs shrink-0">
                  {item.doc.file_type}
                </span>
              </button>
            ) : (
              <button
                key={item.node.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelectFolder(item.node)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center
                  gap-2 transition-colors
                  ${
                    i === mentionIndex
                      ? "bg-blue-600/30 text-blue-300"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
              >
                <FolderIcon size={12} className="text-yellow-400 shrink-0" />
                <span className="truncate flex-1">{item.node.path}</span>
                <span className="text-gray-600 text-xs shrink-0">
                  {
                    collectDocsUnderFolder(item.node).filter(
                      (d) => !mentionedDocs.some((m) => m.id === d.id),
                    ).length
                  }{" "}
                  files
                </span>
              </button>
            ),
          )
        )}
      </div>
    </div>
  );
}
