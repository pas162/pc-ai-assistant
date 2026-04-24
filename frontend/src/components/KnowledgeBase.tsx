import { useEffect, useState, useRef, useCallback } from "react";
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  createFolder,
  deleteFolder, // ← new API calls
} from "../api";
import type { Document, Folder } from "../api";
import type { ToastType } from "../hooks/useToast";
import { Upload, FolderPlus } from "lucide-react";
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootFileInputRef = useRef<HTMLInputElement>(null);
  const rootFolderInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      console.log("fetchAll: starting...");

      // ADD: bypass axios, use raw fetch to isolate the issue
      const [docsRes, folsRes] = await Promise.all([
        fetch("http://localhost:8000/documents"),
        fetch("http://localhost:8000/folders"),
      ]);
      console.log("fetch status:", docsRes.status, folsRes.status);

      const docs = (await docsRes.json()) as Document[];
      const fols = (await folsRes.json()) as Folder[];
      console.log("docs OK", docs.length, "folders OK", fols.length);

      setDocuments(docs);
      setFolders(fols);
    } catch (e) {
      console.error("fetchAll error:", e);
      showToast("Failed to load knowledge base", "error");
    } finally {
      console.log("fetchAll: done");
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
          console.log("webkitRelativePath:", relativePath);
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

        // Upload each file into its folder
        console.log("Folders created. Starting file uploads...");

        for (let i = 0; i < fileEntries.length; i++) {
          const { file, folderPath } = fileEntries[i];
          console.log(`Uploading: ${file.name} → folder_path: "${folderPath}"`);

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
    <div className="p-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Knowledge Base</h2>
          <p className="text-gray-400 text-sm mt-1">
            Supports PDF, DOCX, TXT, MD, XLSX, and code files.
          </p>
        </div>

        {/* Root-level action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreateFolder(null)}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600
                       text-white px-3 py-2 rounded transition-colors text-sm"
          >
            <FolderPlus size={14} />
            New Folder
          </button>

          <button
            onClick={() => rootFileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700
                       text-white px-3 py-2 rounded transition-colors
                       disabled:opacity-50 text-sm"
          >
            <Upload size={14} />
            {uploading ? `Uploading ${uploadProgress}%` : "Upload Files"}
          </button>

          <button
            onClick={() => rootFolderInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600
                       text-white px-3 py-2 rounded transition-colors
                       disabled:opacity-50 text-sm"
          >
            <Upload size={14} />
            Upload Folder
          </button>
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

      {/* Upload Progress Bar */}
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

      {/* Tree */}
      <div
        className="bg-gray-900 shadow rounded-lg overflow-hidden
                      border border-gray-700"
      >
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading knowledge base...
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
