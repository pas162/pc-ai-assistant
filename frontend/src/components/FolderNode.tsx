import { useState, useRef } from "react";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Plus, Upload, Trash2
} from "lucide-react";
import type { Document } from "../api";
import DocumentRow from "./DocumentRow";

// ── Types ─────────────────────────────────────────────────────────────────
export interface FolderNodeData {
  id: string;
  name: string;
  path: string;
  children: FolderNodeData[];   // nested folders
  documents: Document[];        // files directly in this folder
}

interface FolderNodeProps {
  node: FolderNodeData;
  depth: number;
  onDeleteDoc: (doc: Document) => void;
  onDeleteFolder: (id: string, path: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onUploadFiles: (folderPath: string, files: FileList) => void;
  onUploadFolder: (folderPath: string, files: FileList) => void;
}

export default function FolderNode({
  node, depth,
  onDeleteDoc, onDeleteFolder,
  onCreateFolder, onUploadFiles, onUploadFolder
}: FolderNodeProps) {
  const [expanded, setExpanded]   = useState(true);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const folderInputRef            = useRef<HTMLInputElement>(null);
  const indentPx                  = depth * 16;
  const hasChildren               = node.children.length > 0 || node.documents.length > 0;

  return (
    <div>
      {/* ── Folder Row ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-1.5 
                   hover:bg-gray-800 transition-colors group cursor-pointer
                   border-b border-gray-700/30"
        style={{ paddingLeft: `${indentPx + 8}px` }}
      >
        {/* Left — chevron + icon + name */}
        <div
          className="flex items-center gap-1.5 min-w-0"
          onClick={() => setExpanded(e => !e)}
        >
          {/* Chevron — only show if has contents */}
          <span className="text-gray-500 w-4 shrink-0">
            {hasChildren
              ? expanded
                ? <ChevronDown size={13} />
                : <ChevronRight size={13} />
              : <span className="w-4 inline-block" />
            }
          </span>

          {expanded
            ? <FolderOpen size={14} className="text-yellow-400 shrink-0" />
            : <Folder     size={14} className="text-yellow-400 shrink-0" />
          }

          <span className="text-sm font-medium text-gray-200 truncate">
            {node.name}
          </span>
        </div>

        {/* Right — action buttons (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 
                        transition-opacity shrink-0 ml-2">

          {/* Create subfolder */}
          <button
            onClick={() => onCreateFolder(node.path)}
            title="New subfolder"
            className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
          >
            <Plus size={13} />
          </button>

          {/* Upload files into this folder */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload files here"
            className="p-1 text-gray-400 hover:text-green-400 transition-colors"
          >
            <Upload size={13} />
          </button>

          {/* Upload folder into this folder */}
          <button
            onClick={() => folderInputRef.current?.click()}
            title="Upload folder here"
            className="p-1 text-gray-400 hover:text-green-400 transition-colors"
          >
            <Folder size={13} />
          </button>

          {/* Delete this folder */}
          <button
            onClick={() => onDeleteFolder(node.id, node.path)}
            title="Delete folder"
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => e.target.files && onUploadFiles(node.path, e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        // WHY webkitdirectory? This tells the browser to let the user
        // pick an entire folder. The browser preserves the relative paths
        // in file.webkitRelativePath — e.g. "my-project/src/Main.java"
        {...{ webkitdirectory: "true", mozdirectory: "true" } as object}
        onChange={e => e.target.files && onUploadFolder(node.path, e.target.files)}
      />

      {/* ── Children (recursive) ─────────────────────────────────────── */}
      {expanded && (
        <div>
          {/* Nested folders first */}
          {node.children.map(child => (
            <FolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onDeleteDoc={onDeleteDoc}
              onDeleteFolder={onDeleteFolder}
              onCreateFolder={onCreateFolder}
              onUploadFiles={onUploadFiles}
              onUploadFolder={onUploadFolder}
            />
          ))}

          {/* Then documents in this folder */}
          {node.documents.map(doc => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              depth={depth + 1}
              onDelete={onDeleteDoc}
            />
          ))}
        </div>
      )}
    </div>
  );
}