import { useEffect, useState, useRef, useCallback } from "react";
import { getDocuments, uploadDocument, deleteDocument } from "../api";
import type { Document } from "../api";
import type { ToastType } from "../hooks/useToast";
import { Upload, FileText } from "lucide-react";

interface KnowledgeBaseProps {
  showToast: (message: string, type: ToastType) => void;
}

export default function KnowledgeBase({ showToast }: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch Documents ───────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data);
      return data;
    } catch {
      setError("Failed to load documents");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // ── Polling Logic ─────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      const data = await getDocuments();
      setDocuments(data);

      const stillProcessing = data.some(
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

  // ── Upload Logic ──────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setUploadProgress(0);

      // I accidentally removed this callback in the last step! It's back now.
      await uploadDocument(file, (percent) => {
        setUploadProgress(percent);
      });

      await fetchDocs();
      showToast("File uploaded! Processing in background...", "info");
      startPolling();
    } catch {
      showToast("Failed to upload document", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Delete / Cancel Logic ─────────────────────────────────────────────────
  const handleDelete = async (doc: Document) => {
    const isProcessing =
      doc.status === "pending" || doc.status === "processing";

    const message = isProcessing
      ? `Cancel processing and delete "${doc.filename}"?`
      : `Delete "${doc.filename}"?\n\nThis will remove it from ALL workspaces. This cannot be undone.`;

    if (!window.confirm(message)) return;

    try {
      await deleteDocument(doc.id);
      await fetchDocs();
      showToast(
        isProcessing
          ? `Canceled "${doc.filename}"`
          : `"${doc.filename}" deleted`,
        "info",
      );
    } catch {
      showToast("Failed to delete document", "error");
    }
  };

  // ── Status Badge Colors ───────────────────────────────────────────────────
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

  return (
    <div className="p-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Knowledge Base</h2>
          <p className="text-gray-400 text-sm mt-1">
            Supports PDF, DOCX, TXT, MD, XLSX.
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.txt,.docx,.md,.xlsx"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 
                     rounded transition-colors disabled:opacity-50 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Upload size={14} />
            {uploading ? `Uploading ${uploadProgress}%` : "Upload File"}
          </span>
        </button>
      </div>

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Uploading file to server...</span>
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

      {/* Error */}
      {error && (
        <div className="bg-red-900 text-red-300 p-3 rounded mb-4 border border-red-700">
          {error}
        </div>
      )}

      {/* Document Table */}
      <div className="bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-700">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No documents uploaded yet. Click "Upload File" to add one.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-24">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-40">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-24">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-gray-800 transition-colors"
                >
                  <td
                    className="px-6 py-4 text-sm font-medium text-gray-200 max-w-xs truncate"
                    title={doc.filename}
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      {doc.filename}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 uppercase">
                    {doc.file_type || "unknown"}
                  </td>

                  {/* ── STATUS COLUMN (Processing Progress Bar) ── */}
                  <td className="px-6 py-4 text-sm">
                    {doc.status === "processing" ? (
                      <div className="flex flex-col gap-1 min-w-32">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span className="text-blue-400">Processing...</span>
                          <span>{doc.progress ?? 0}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${doc.progress ?? 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(doc.status)}`}
                      >
                        {doc.status}
                      </span>
                    )}
                  </td>

                  {/* ── ACTION COLUMN (Cancel / Delete Button) ── */}
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleDelete(doc)}
                      className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                    >
                      {doc.status === "pending" || doc.status === "processing"
                        ? "Cancel"
                        : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
