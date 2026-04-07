import { useState, useEffect } from "react";
import {
  getDocuments,
  linkDocumentToWorkspace,
  unlinkDocumentFromWorkspace,
} from "../api";
import type { Workspace, Document } from "../api";
import ChatPanel from "./ChatPanel";

interface WorkspaceDetailProps {
  workspace: Workspace;
}

export default function WorkspaceDetail({ workspace }: WorkspaceDetailProps) {
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<Document[]>(
    workspace.documents,
  );
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // Fetch all KB documents when the modal opens
  useEffect(() => {
    if (showAttachModal) {
      getDocuments()
        .then(setAllDocuments)
        .catch(() => {});
    }
  }, [showAttachModal]);

  // When user clicks a different workspace in the sidebar,
  // reset the attached docs list to the new workspace's documents
  useEffect(() => {
    setAttachedDocs(workspace.documents);
  }, [workspace.id, workspace.documents]); // ← added workspace.documents here
  // ── Attach ─────────────────────────────────────────

  const handleAttach = async (doc: Document) => {
    try {
      setAttaching(true);
      await linkDocumentToWorkspace(workspace.id, doc.id);
      setAttachedDocs((prev) => [...prev, doc]);
      setShowAttachModal(false);
    } catch {
      alert("Failed to attach document");
    } finally {
      setAttaching(false);
    }
  };

  // ── Detach ─────────────────────────────────────────

  const handleDetach = async (doc: Document) => {
    if (!window.confirm(`Remove "${doc.filename}" from this workspace?`))
      return;
    try {
      await unlinkDocumentFromWorkspace(workspace.id, doc.id);
      setAttachedDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      alert("Failed to detach document");
    }
  };

  // Documents in KB that are NOT yet attached to this workspace
  const unattachedDocs = allDocuments.filter(
    (doc) => !attachedDocs.some((attached) => attached.id === doc.id),
  );

  // ── Render ─────────────────────────────────────────

  return (
    <div className="p-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{workspace.name}</h2>
        {workspace.description && (
          <p className="text-gray-500 text-sm mt-1">{workspace.description}</p>
        )}
      </div>

      {/* Attached Documents */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-700">Attached Documents</h3>
          <button
            onClick={() => setShowAttachModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded"
          >
            + Attach Document
          </button>
        </div>

        {attachedDocs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No documents attached yet. Click "Attach Document" to add one from
            the Knowledge Base.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attachedDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {doc.filename}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 uppercase">
                    {doc.file_type || "unknown"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleDetach(doc)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Chat Panel — NEW */}
      <ChatPanel workspaceId={workspace.id} />

      {/* ── ATTACH MODAL ──────────────────────────────── */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-gray-900 text-lg font-semibold mb-4">
              Attach Document from Knowledge Base
            </h2>

            {unattachedDocs.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                All documents are already attached, or the Knowledge Base is
                empty.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto border rounded">
                {unattachedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-gray-400 uppercase">
                        {doc.file_type}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAttach(doc)}
                      disabled={attaching}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                    >
                      Attach
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAttachModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
