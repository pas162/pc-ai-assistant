import { FileText, Folder as FolderIcon } from "lucide-react";
import type React from "react";
import type { Document } from "../../api";
import type { FolderNode, MentionItem, MentionMode } from "./types";
import { collectDocsUnderFolder } from "./types";

// Re-export MentionItem type so ChatPanel can use it
export type { MentionItem };

interface MentionDropdownProps {
  mentionItems: MentionItem[];
  mentionIndex: number;
  mentionSearch: string;
  mentionMode: MentionMode;
  mentionedDocs: Document[];
  workspaceDocsCompletedCount: number;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onIndexChange: React.Dispatch<React.SetStateAction<number>>;
  onSelectFile: (doc: Document) => void;
  onSelectFolder: (node: FolderNode) => void;
  onSelectMode: (mode: MentionMode) => void;
  onClose: () => void;
}

export default function MentionDropdown({
  mentionItems,
  mentionIndex,
  mentionSearch,
  mentionMode,
  workspaceDocsCompletedCount,
  dropdownRef,
  onSelectFile,
  onSelectFolder,
  onSelectMode,
}: MentionDropdownProps) {
  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-1 w-72 bg-gray-800 border
                 border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden"
    >
      {/* ── Mode picker ── */}
      {mentionMode === "all" && mentionSearch === "" && (
        <div className="flex flex-col">
          <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-700">
            Search by
          </div>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectMode("files");
            }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm
                       transition-colors
                       ${
                         mentionIndex === 0
                           ? "bg-blue-600 text-white"
                           : "text-gray-300 hover:bg-gray-700"
                       }`}
          >
            <FileText
              size={14}
              className={mentionIndex === 0 ? "text-white" : "text-blue-400"}
            />
            <span>Files</span>
            <span
              className={`ml-auto text-xs ${
                mentionIndex === 0 ? "text-blue-200" : "text-gray-500"
              }`}
            >
              {workspaceDocsCompletedCount} available
            </span>
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectMode("folders");
            }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm
                       transition-colors
                       ${
                         mentionIndex === 1
                           ? "bg-blue-600 text-white"
                           : "text-gray-300 hover:bg-gray-700"
                       }`}
          >
            <FolderIcon
              size={14}
              className={mentionIndex === 1 ? "text-white" : "text-yellow-400"}
            />
            <span>Folders</span>
          </button>
        </div>
      )}

      {/* ── Mode selected or typing without mode ── */}
      {(mentionMode !== "all" || mentionSearch !== "") && (
        <>
          {/* Mode indicator pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700">
            {mentionMode !== "all" ? (
              <span
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                ${
                  mentionMode === "files"
                    ? "bg-blue-900 text-blue-300"
                    : "bg-yellow-900 text-yellow-300"
                }`}
              >
                {mentionMode === "files" ? (
                  <FileText size={10} />
                ) : (
                  <FolderIcon size={10} />
                )}
                {mentionMode === "files" ? "Files" : "Folders"}
              </span>
            ) : (
              <span className="text-xs text-gray-500 italic">
                All — "{mentionSearch}"
              </span>
            )}
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectMode("all");
              }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              clear
            </button>
          </div>

          {/* Results */}
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {mentionItems.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No results
              </p>
            ) : (
              mentionItems.map((item, i) =>
                item.type === "file" ? (
                  <button
                    key={item.doc.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectFile(item.doc);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm
                      transition-colors text-left
                      ${
                        i === mentionIndex
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                  >
                    <FileText
                      size={13}
                      className={
                        i === mentionIndex ? "text-white" : "text-blue-400"
                      }
                    />
                    <span className="truncate">{item.doc.filename}</span>
                  </button>
                ) : (
                  <button
                    key={item.node.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectFolder(item.node);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm
                      transition-colors text-left
                      ${
                        i === mentionIndex
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                  >
                    <FolderIcon
                      size={13}
                      className={
                        i === mentionIndex ? "text-white" : "text-yellow-400"
                      }
                    />
                    <span className="truncate">{item.node.name}</span>
                    <span
                      className={`ml-auto text-xs shrink-0
                      ${i === mentionIndex ? "text-blue-200" : "text-gray-500"}`}
                    >
                      {collectDocsUnderFolder(item.node).length} files
                    </span>
                  </button>
                ),
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
