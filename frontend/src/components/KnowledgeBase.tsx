import { useEffect, useState, useRef } from "react";
import { getDocuments, uploadDocument, deleteDocument } from "../api";
import type { Document } from "../api";
import type { ToastType } from "../hooks/useToast";

interface KnowledgeBaseProps {
  showToast: (message: string, type: ToastType) => void;
}

export default function KnowledgeBase({ showToast }: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data);
    } catch {
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      await uploadDocument(file);
      await fetchDocs();
      showToast("File uploaded successfully!", "success");
    } catch {
      showToast("Failed to upload document", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!window.confirm(
      `Delete "${doc.filename}"?\n\nThis will remove it from ALL workspaces. This cannot be undone.`
    )) return;
    try {
      await deleteDocument(doc.id);
      await fetchDocs();
      showToast(`"${doc.filename}" deleted`, "info");
    } catch {
      showToast("Failed to delete document", "error");
    }
  };

  // ── Status badge ────────────────────────────────────────────────────────────
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case "completed":  return "bg-green-900 text-green-300";
      case "processing": return "bg-blue-900 text-blue-300";
      case "failed":     return "bg-red-900 text-red-300";
      default:           return "bg-yellow-900 text-yellow-300";
    }
  }

  return (
    <div className="p-8 w-full max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Knowledge Base</h2>
          <p className="text-gray-400 text-sm mt-1">
            Central repository for all your AI documents.
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.txt,.docx,.md"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 
                     rounded transition-colors disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "⬆️ Upload File"}
        </button>
      </div>

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-28">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-28">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-24">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-800 transition-colors">
                  <td
                    className="px-6 py-4 text-sm font-medium text-gray-200 max-w-xs truncate"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 uppercase">
                    {doc.file_type || "unknown"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {doc.file_size
                      ? `${(doc.file_size / 1024).toFixed(1)} KB`
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold 
                      rounded-full ${getStatusBadgeClass(doc.status)}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleDelete(doc)}
                      className="text-red-400 hover:text-red-300 
                                 text-xs font-medium transition-colors"
                    >
                      🗑️ Delete
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