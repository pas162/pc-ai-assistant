import { useEffect, useState, useRef, useCallback } from "react";
import {
  getDocuments,
  getFolders,
  uploadDocument,
  deleteDocument,
  createFolder,
  deleteFolder,
} from "../api";
import type { Document, Folder } from "../api";
import type { ToastType } from "../hooks/useToast";
import {
  Upload,
  FolderPlus,
  Database,
  FileText,
  FolderOpen,
  ChevronDown,
} from "lucide-react";
import FolderTree from "./FolderTree";

interface KnowledgeBaseProps {
  showToast: (message: string, type: ToastType) => void;
}

export default function KnowledgeBase({ showToast }: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootFileInputRef = useRef<HTMLInputElement>(null);
  const rootFolderInputRef = useRef<HTMLInputElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  // ── Close upload menu when clicking outside ───────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        uploadMenuRef.current &&
        !uploadMenuRef.current.contains(e.target as Node)
      ) {
        setShowUploadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [docs, fols] = await Promise.all([getDocuments(), getFolders()]);
      setDocuments(docs);
      setFolders(fols);
    } catch {
      showToast("Failed to load knowledge base", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Polling ───────────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const docs = await getDocuments();
      setDocuments(docs);
      const stillProcessing = docs.some(
        (d) => d.status === "pending" || d.status === "processing",
      );
      if (!stillProcessing) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Upload Files (single or multiple) ────────────────────────────────────
  const handleUploadFiles = useCallback(
    async (folderPath: string | null, files: FileList) => {
      setUploading(true);
      setUploadProgress(0);
      let successCount = 0;

      try {
        for (let i = 0; i < files.length; i++) {
          await uploadDocument(
            files[i],
            (percent) => {
              // Overall progress across all files
              const overall = Math.round(
                ((i + percent / 100) / files.length) * 100,
              );
              setUploadProgress(overall);
            },
            folderPath ?? undefined,
          );
          successCount++;
        }
        await fetchAll();
        showToast(
          `${successCount} file(s) uploaded! Processing in background...`,
          "info",
        );
        startPolling();
      } catch {
        showToast("Failed to upload one or more files", "error");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [fetchAll, showToast, startPolling],
  );

  // ── Upload Folder (webkitdirectory) ───────────────────────────────────────
  const handleUploadFolder = useCallback(
    async (targetFolderPath: string | null, files: FileList) => {
      setUploading(true);
      setUploadProgress(0);
      try {
        // Group files by their folder structure
        // file.webkitRelativePath = "my-project/src/Main.java"
        const foldersToCreate = new Set<string>();
        const fileEntries: { file: File; folderPath: string }[] = [];

        for (const file of Array.from(files)) {
          const relativePath = (file as File & { webkitRelativePath: string })
            .webkitRelativePath;
          // Strip filename, keep folder part
          const parts = relativePath.split("/");
          parts.pop(); // remove filename

          // Build full path: targetFolder + relative folder path
          const relFolderPath = parts.join("/");
          const fullFolderPath = targetFolderPath
            ? `${targetFolderPath}/${relFolderPath}`
            : relFolderPath;

          // Collect all intermediate paths to create
          // e.g. "java-project/src/controllers" needs:
          //   "java-project", "java-project/src", "java-project/src/controllers"
          const pathParts = fullFolderPath.split("/");
          for (let i = 1; i <= pathParts.length; i++) {
            foldersToCreate.add(pathParts.slice(0, i).join("/"));
          }

          fileEntries.push({ file, folderPath: fullFolderPath });
        }

        // Create all folders first (sorted so parents come before children)
        const sortedFolders = Array.from(foldersToCreate).sort();
        for (const folderPath of sortedFolders) {
          const parts = folderPath.split("/");
          const name = parts[parts.length - 1];
          const parent = parts.length > 1 ? parts.slice(0, -1).join("/") : null;
          try {
            await createFolder(name, parent);
          } catch {
            // Folder may already exist — that's fine, continue
          }
        }

        for (let i = 0; i < fileEntries.length; i++) {
          const { file, folderPath } = fileEntries[i];
          await uploadDocument(
            file,
            (percent) => {
              const overall = Math.round(
                ((i + percent / 100) / fileEntries.length) * 100,
              );
              setUploadProgress(overall);
            },
            folderPath,
          );
        }

        await fetchAll();
        showToast(
          `Folder uploaded! ${fileEntries.length} files processing...`,
          "info",
        );
        startPolling();
      } catch {
        showToast("Failed to upload folder", "error");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [fetchAll, showToast, startPolling],
  );

  // ── Delete Document ───────────────────────────────────────────────────────
  const handleDeleteDoc = useCallback(
    async (doc: Document) => {
      const isProcessing =
        doc.status === "pending" || doc.status === "processing";
      const message = isProcessing
        ? `Cancel processing and delete "${doc.filename}"?`
        : `Delete "${doc.filename}"?\n\nThis cannot be undone.`;
      if (!window.confirm(message)) return;
      try {
        await deleteDocument(doc.id);
        await fetchAll();
        showToast(
          isProcessing
            ? `Canceled "${doc.filename}"`
            : `"${doc.filename}" deleted`,
          "info",
        );
      } catch {
        showToast("Failed to delete document", "error");
      }
    },
    [fetchAll, showToast],
  );

  // ── Delete Folder ─────────────────────────────────────────────────────────
  const handleDeleteFolder = useCallback(
    async (id: string, path: string) => {
      if (
        !window.confirm(
          `Delete folder "${path}" and ALL its contents?\n\nThis cannot be undone.`,
        )
      )
        return;
      try {
        await deleteFolder(id);
        await fetchAll();
        showToast(`Folder "${path}" deleted`, "info");
      } catch {
        showToast("Failed to delete folder", "error");
      }
    },
    [fetchAll, showToast],
  );

  // ── Create Folder ─────────────────────────────────────────────────────────
  const handleCreateFolder = useCallback(
    async (parentPath: string | null) => {
      const name = window
        .prompt(
          parentPath
            ? `New folder inside "${parentPath}":`
            : "New root folder name:",
        )
        ?.trim();
      if (!name) return;
      try {
        await createFolder(name, parentPath);
        await fetchAll();
        showToast(`Folder "${name}" created`, "success");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to create folder";
        showToast(msg, "error");
      }
    },
    [fetchAll, showToast],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 w-full max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database size={20} className="text-blue-400" />
            <h2 className="text-xl font-bold text-gray-100">Knowledge Base</h2>
          </div>
          <p className="text-gray-500 text-sm">
            Supports PDF, DOCX, TXT, MD, XLSX, and code files.
          </p>

          {/* Stats bar */}
          {!loading && (
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <FileText size={12} className="text-gray-600" />
                {documents.length} file{documents.length !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <FolderOpen size={12} className="text-gray-600" />
                {folders.length} folder{folders.length !== 1 ? "s" : ""}
              </span>
              {documents.some(
                (d) => d.status === "pending" || d.status === "processing",
              ) && (
                <span className="flex items-center gap-1.5 text-xs text-blue-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  Processing...
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* New Folder */}
          <button
            onClick={() => handleCreateFolder(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md
                       text-sm text-gray-400 hover:text-gray-100
                       border border-gray-700 hover:border-gray-500
                       hover:bg-gray-800 transition-all duration-150"
          >
            <FolderPlus size={14} />
            New Folder
          </button>

          {/* Upload button with dropdown */}
          <div className="relative" ref={uploadMenuRef}>
            <button
              disabled={uploading}
              onClick={() => setShowUploadMenu((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md
                         text-sm text-white bg-blue-600 hover:bg-blue-500
                         transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {uploading ? `Uploading ${uploadProgress}%` : "Upload"}
              <ChevronDown
                size={13}
                className={`transition-transform duration-150 ${
                  showUploadMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown menu */}
            {showUploadMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-44 z-50
                              bg-gray-800 border border-gray-700 rounded-md
                              shadow-xl overflow-hidden"
              >
                <button
                  onClick={() => {
                    setShowUploadMenu(false);
                    rootFileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                             text-gray-300 hover:bg-gray-700 hover:text-white
                             transition-colors"
                >
                  <Upload size={13} className="text-blue-400" />
                  Upload Files
                </button>
                <div className="h-px bg-gray-700" />
                <button
                  onClick={() => {
                    setShowUploadMenu(false);
                    rootFolderInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                             text-gray-300 hover:bg-gray-700 hover:text-white
                             transition-colors"
                >
                  <FolderOpen size={13} className="text-green-400" />
                  Upload Folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden root-level inputs */}
      <input
        ref={rootFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) =>
          e.target.files && handleUploadFiles(null, e.target.files)
        }
      />
      <input
        ref={rootFolderInputRef}
        type="file"
        className="hidden"
        {...({ webkitdirectory: "true" } as object)}
        onChange={(e) =>
          e.target.files && handleUploadFolder(null, e.target.files)
        }
      />

      {/* ── Upload Progress Bar ─────────────────────────────────────────────── */}
      {uploading && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Tree ───────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-700">
        {loading ? (
          // ── Loading skeleton ──────────────────────────────────────────────
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-4 h-4 bg-gray-700 rounded" />
                <div
                  className="h-3 bg-gray-700 rounded"
                  style={{ width: `${30 + i * 15}%` }}
                />
              </div>
            ))}
          </div>
        ) : documents.length === 0 && folders.length === 0 ? (
          // ── Empty state ───────────────────────────────────────────────────
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <Database size={36} className="text-gray-700" />
            <p className="text-gray-400 font-medium">
              Your Knowledge Base is empty
            </p>
            <p className="text-gray-600 text-sm max-w-xs">
              Upload files or folders to get started. Supported formats: PDF,
              DOCX, TXT, MD, XLSX, and code files.
            </p>
            <button
              onClick={() => rootFileInputRef.current?.click()}
              className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700
                         text-white px-4 py-2 rounded transition-colors text-sm"
            >
              <Upload size={14} />
              Upload your first file
            </button>
          </div>
        ) : (
          <FolderTree
            folders={folders}
            documents={documents}
            onDeleteDoc={handleDeleteDoc}
            onDeleteFolder={handleDeleteFolder}
            onCreateFolder={handleCreateFolder}
            onUploadFiles={handleUploadFiles}
            onUploadFolder={handleUploadFolder}
          />
        )}
      </div>
    </div>
  );
}
