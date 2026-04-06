import { useEffect, useState, useRef } from "react";
import { getDocuments, uploadDocument } from "../api";
import type { Document } from "../api";

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference to the hidden file input
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
      await fetchDocs(); // Refresh the list after upload
    } catch {
      alert("Failed to upload document");
    } finally {
      setUploading(false);
      // Reset the input so the same file can be uploaded again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8 w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Knowledge Base</h2>
          <p className="text-gray-500 text-sm mt-1">
            Central repository for all your AI documents.
          </p>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.txt,.docx,.md" // Restrict file types
        />

        {/* Custom Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      {/* Document List */}
      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No documents uploaded yet. Click "Upload File" to add one.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {doc.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">
                    {doc.file_type || "unknown"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc.file_size
                      ? `${(doc.file_size / 1024).toFixed(1)} KB`
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      {doc.status}
                    </span>
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
