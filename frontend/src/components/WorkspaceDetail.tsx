import { useState, useEffect } from "react";
import {
  getDocuments,
  linkDocumentToWorkspace,
  unlinkDocumentFromWorkspace,
  // ← removed: updateWorkspace
} from "../api";
import type { Workspace, Document } from "../api";
import type { ToastType } from "../hooks/useToast";
import ChatPanel from "./ChatPanel";

interface WorkspaceDetailProps {
  workspace: Workspace;
  showToast: (message: string, type: ToastType) => void;
}

type Tab = "chat" | "documents";

export default function WorkspaceDetail({
  workspace,
  showToast,
}: WorkspaceDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<Document[]>(
    workspace.documents,
  );
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  // ← removed: editName, editDescription, saving

  useEffect(() => {
    if (showAttachModal) {
      getDocuments()
        .then(setAllDocuments)
        .catch(() => {});
    }
  }, [showAttachModal]);

  useEffect(() => {
    setAttachedDocs(workspace.documents);
    setActiveTab("chat");
    // ← removed: setEditName, setEditDescription
  }, [workspace.id, workspace.documents]);
  // ← removed: workspace.name, workspace.description from deps
  // ── Attach ──────────────────────────────────────────────────────────────────
  const handleAttach = async (doc: Document) => {
    try {
      setAttachingId(doc.id);
      await linkDocumentToWorkspace(workspace.id, doc.id);
      setAttachedDocs((prev) => [...prev, doc]);
      setShowAttachModal(false);
      showToast(`"${doc.filename}" attached!`, "success");
    } catch {
      showToast("Failed to attach document", "error");
    } finally {
      setAttachingId(null);
    }
  };

  // ── Detach ──────────────────────────────────────────────────────────────────
  const handleDetach = async (doc: Document) => {
    if (!window.confirm(`Remove "${doc.filename}" from this workspace?`))
      return;
    try {
      await unlinkDocumentFromWorkspace(workspace.id, doc.id);
      setAttachedDocs((prev) => prev.filter((d) => d.id !== doc.id));
      showToast(`"${doc.filename}" removed`, "info");
    } catch {
      showToast("Failed to detach document", "error");
    }
  };
  // ← removed: handleSave entirely

  const unattachedDocs = allDocuments.filter(
    (doc) => !attachedDocs.some((attached) => attached.id === doc.id),
  );

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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* ── Header + Tabs ─────────────────────────────────────────────────── */}
      <div className="px-8 pt-6 pb-0 border-b border-gray-700">
        <h2 className="text-2xl font-bold text-gray-100">{workspace.name}</h2>
        {workspace.description && (
          <p className="text-gray-400 text-sm mt-1">{workspace.description}</p>
        )}
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors
              ${
                activeTab === "chat"
                  ? "bg-gray-900 border border-b-gray-900 border-gray-700 text-blue-400 -mb-px"
                  : "text-gray-500 hover:text-gray-300"
              }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors
              ${
                activeTab === "documents"
                  ? "bg-gray-900 border border-b-gray-900 border-gray-700 text-blue-400 -mb-px"
                  : "text-gray-500 hover:text-gray-300"
              }`}
          >
            Documents
            {attachedDocs.length > 0 && (
              <span className="ml-2 bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
                {attachedDocs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* ── CHAT TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "chat" && (
          <ChatPanel workspaceId={workspace.id} showToast={showToast} />
        )}

        {/* ── DOCUMENTS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="flex flex-col gap-6">
            <div className="bg-gray-900 shadow rounded-lg border border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <h3 className="font-semibold text-gray-200">
                  Attached Documents
                </h3>
                <button
                  onClick={() => setShowAttachModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white
                             text-sm px-3 py-1.5 rounded transition-colors"
                >
                  + Attach Document
                </button>
              </div>

              {attachedDocs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No documents attached yet. Click "Attach Document" to add one
                  from the Knowledge Base.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Filename
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {attachedDocs.map((doc) => (
                      <tr
                        key={doc.id}
                        className="hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-200">
                          {doc.filename}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400 uppercase">
                          {doc.file_type || "unknown"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(doc.status)}`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleDetach(doc)}
                            className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
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
          </div>
        )}
      </div>

      {/* ── ATTACH MODAL ──────────────────────────────────────────────────── */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 border border-gray-700">
            <h2 className="text-gray-100 text-lg font-semibold mb-4">
              Attach Document from Knowledge Base
            </h2>

            {unattachedDocs.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                All documents are already attached, or the Knowledge Base is
                empty.
              </p>
            ) : (
              <div className="divide-y divide-gray-700 max-h-80 overflow-y-auto border border-gray-700 rounded">
                {unattachedDocs.map((doc) => {
                  const isReady = doc.status === "completed";
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-800"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-500 uppercase">
                            {doc.file_type}
                          </p>
                          <span
                            className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeClass(doc.status)}`}
                          >
                            {doc.status}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAttach(doc)}
                        disabled={!isReady || attachingId !== null}
                        title={
                          !isReady
                            ? "Document must finish processing before attaching"
                            : ""
                        }
                        className="text-sm font-medium transition-colors
                                   disabled:opacity-40 disabled:cursor-not-allowed
                                   text-blue-400 hover:text-blue-300"
                      >
                        {!isReady
                          ? "Not ready"
                          : attachingId === doc.id
                            ? "Attaching..."
                            : "Attach"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAttachModal(false)}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-600
                           rounded hover:bg-gray-800 transition-colors"
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
