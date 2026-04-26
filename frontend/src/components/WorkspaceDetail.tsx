import { useState, useEffect, useMemo } from "react";
import {
  getDocuments,
  getFolders,
  unlinkDocumentFromWorkspace,
  bulkLinkDocumentsToWorkspace,
} from "../api";
import type { Workspace, Document, Folder } from "../api";
import type { ToastType } from "../hooks/useToast";
import ChatPanel from "./chat/ChatPanel";
import { SwtbotWorkflow } from "./workflows";
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  Bot,
} from "lucide-react";

interface WorkspaceDetailProps {
  workspace: Workspace;
  showToast: (message: string, type: ToastType) => void;
  activeSessionId: string | null;
  onSessionChange: (workspaceId: string, sessionId: string) => void;
}

type Tab = "chat" | "documents" | "workflows";

// ── Folder tree node type ─────────────────────────────────────────────────
interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  children: FolderTreeNode[];
  documents: Document[];
}

export default function WorkspaceDetail({
  workspace,
  showToast,
  activeSessionId,
  onSessionChange,
}: WorkspaceDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<Document[]>(
    workspace.documents,
  );
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);
  const [attachedExpandedPaths, setAttachedExpandedPaths] = useState<
    Set<string>
  >(new Set());

  // ── Sync attached docs when workspace changes ─────────────────────────────
  useEffect(() => {
    setAttachedDocs(workspace.documents);
    setActiveTab("chat");
  }, [workspace.id, workspace.documents]);

  // ── Fetch folders on mount so attached tree has structure ─────────────────
  useEffect(() => {
    getFolders()
      .then(setFolders)
      .catch(() => {});
  }, []);

  // ── Fetch all docs + folders when modal opens ─────────────────────────────
  useEffect(() => {
    if (showAttachModal) {
      Promise.all([getDocuments(), getFolders()])
        .then(([docs, fols]) => {
          setAllDocuments(docs);
          setFolders(fols);
          // Auto-expand all folders so user sees the full tree immediately
          setExpandedPaths(new Set(fols.map((f) => f.path)));
        })
        .catch(() => {});
    } else {
      // Reset selection when modal closes
      setSelectedIds(new Set());
    }
  }, [showAttachModal]);

  // ── Build folder tree from flat lists ────────────────────────────────────
  // WHY useMemo? This recalculates only when docs, folders, or attachedDocs
  // change — not on every render. Tree assembly is O(n) but still worth caching.
  const { rootFolders, rootDocuments } = useMemo(() => {
    // Only show unattached + completed docs in the modal
    const available = allDocuments.filter(
      (doc) =>
        doc.status === "completed" &&
        !attachedDocs.some((a) => a.id === doc.id),
    );

    // Step 1 — build path → node map
    const nodeMap = new Map<string, FolderTreeNode>();
    for (const f of folders) {
      nodeMap.set(f.path, {
        id: f.id,
        name: f.name,
        path: f.path,
        children: [],
        documents: [],
      });
    }

    // Step 2 — link children to parents
    const rootFolders: FolderTreeNode[] = [];
    for (const f of folders) {
      const node = nodeMap.get(f.path)!;
      const lastSlash = f.path.lastIndexOf("/");
      if (lastSlash === -1) {
        rootFolders.push(node);
      } else {
        const parent = nodeMap.get(f.path.substring(0, lastSlash));
        if (parent) parent.children.push(node);
        else rootFolders.push(node);
      }
    }

    // Step 3 — attach documents to their folder node
    const rootDocuments: Document[] = [];
    for (const doc of available) {
      if (!doc.folder_path) {
        rootDocuments.push(doc);
      } else {
        const node = nodeMap.get(doc.folder_path);
        if (node) node.documents.push(doc);
        else rootDocuments.push(doc); // orphan → show at root
      }
    }

    // Step 4 — sort alphabetically
    rootFolders.sort((a, b) => a.name.localeCompare(b.name));
    rootDocuments.sort((a, b) => a.filename.localeCompare(b.filename));

    return { rootFolders, rootDocuments };
  }, [allDocuments, folders, attachedDocs]);

  // ── Attached docs tree ────────────────────────────────────────────────────
  const { attachedRootFolders, attachedRootDocuments } = useMemo(() => {
    const nodeMap = new Map<string, FolderTreeNode>();
    for (const f of folders) {
      nodeMap.set(f.path, {
        id: f.id,
        name: f.name,
        path: f.path,
        children: [],
        documents: [],
      });
    }

    const attachedRootFolders: FolderTreeNode[] = [];
    for (const f of folders) {
      const node = nodeMap.get(f.path)!;
      const lastSlash = f.path.lastIndexOf("/");
      if (lastSlash === -1) {
        attachedRootFolders.push(node);
      } else {
        const parent = nodeMap.get(f.path.substring(0, lastSlash));
        if (parent) parent.children.push(node);
        else attachedRootFolders.push(node);
      }
    }

    const attachedRootDocuments: Document[] = [];
    for (const doc of attachedDocs) {
      if (!doc.folder_path) {
        attachedRootDocuments.push(doc);
      } else {
        const node = nodeMap.get(doc.folder_path);
        if (node) node.documents.push(doc);
        else attachedRootDocuments.push(doc);
      }
    }

    const hasAttachedDocs = (node: FolderTreeNode): boolean => {
      if (node.documents.length > 0) return true;
      return node.children.some(hasAttachedDocs);
    };

    return {
      attachedRootFolders: attachedRootFolders.filter(hasAttachedDocs),
      attachedRootDocuments,
    };
  }, [attachedDocs, folders]);

  // Auto-expand all folders when folders list loads
  useEffect(() => {
    setAttachedExpandedPaths(new Set(folders.map((f) => f.path)));
  }, [folders]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const getDocIdsUnderPath = (path: string): string[] => {
    return allDocuments
      .filter(
        (d) =>
          d.status === "completed" &&
          !attachedDocs.some((a) => a.id === d.id) &&
          (d.folder_path === path || d.folder_path?.startsWith(path + "/")),
      )
      .map((d) => d.id);
  };

  const isFolderFullySelected = (path: string): boolean => {
    const ids = getDocIdsUnderPath(path);
    return ids.length > 0 && ids.every((id) => selectedIds.has(id));
  };

  const isFolderPartiallySelected = (path: string): boolean => {
    const ids = getDocIdsUnderPath(path);
    return (
      ids.some((id) => selectedIds.has(id)) && !isFolderFullySelected(path)
    );
  };

  const toggleFolder = (path: string) => {
    const ids = getDocIdsUnderPath(path);
    const allSel = isFolderFullySelected(path);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSel ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const toggleDoc = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Bulk Attach ───────────────────────────────────────────────────────────
  const handleBulkAttach = async () => {
    if (selectedIds.size === 0) return;
    setAttaching(true);
    try {
      const result = await bulkLinkDocumentsToWorkspace(
        workspace.id,
        Array.from(selectedIds),
      );
      const newlyAttached = allDocuments.filter((d) => selectedIds.has(d.id));
      setAttachedDocs((prev) => [...prev, ...newlyAttached]);
      setShowAttachModal(false);
      showToast(
        `${result.attached.length} document(s) attached!` +
          (result.skipped > 0 ? ` (${result.skipped} skipped)` : ""),
        "success",
      );
    } catch {
      showToast("Failed to attach documents", "error");
    } finally {
      setAttaching(false);
    }
  };

  // ── Detach single doc ─────────────────────────────────────────────────────
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

  // ── Status badge ──────────────────────────────────────────────────────────
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

  // ── Attached folder node renderer ─────────────────────────────────────────
  const renderAttachedFolderNode = (
    node: FolderTreeNode,
    depth = 0,
  ): React.ReactNode => {
    const isExpanded = attachedExpandedPaths.has(node.path);
    const indent = depth * 16;

    const hasAttached = (n: FolderTreeNode): boolean =>
      n.documents.length > 0 || n.children.some(hasAttached);
    if (!hasAttached(node)) return null;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 px-6 py-2 hover:bg-gray-800
                     cursor-pointer border-b border-gray-700/30"
          style={{ paddingLeft: `${indent + 24}px` }}
          onClick={() =>
            setAttachedExpandedPaths((prev) => {
              const next = new Set(prev);
              if (next.has(node.path)) {
                next.delete(node.path);
              } else {
                next.add(node.path);
              }
              return next;
            })
          }
        >
          <span className="text-gray-500">
            {isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </span>
          {isExpanded ? (
            <FolderOpen size={14} className="text-yellow-400 shrink-0" />
          ) : (
            <FolderIcon size={14} className="text-yellow-400 shrink-0" />
          )}
          <span className="text-sm font-medium text-gray-300">{node.name}</span>
          {node.documents.length > 0 && (
            <span className="text-xs text-gray-600 ml-1">
              {node.documents.length} file(s)
            </span>
          )}
        </div>

        {isExpanded && (
          <div>
            {node.children.map((child) =>
              renderAttachedFolderNode(child, depth + 1),
            )}
            {node.documents.map((doc) => renderAttachedDocRow(doc, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderAttachedDocRow = (doc: Document, depth = 0): React.ReactNode => {
    const indent = depth * 16;
    return (
      <div
        key={doc.id}
        className="flex items-center justify-between px-6 py-3
                   hover:bg-gray-800 transition-colors border-b
                   border-gray-700/50 last:border-0 group"
        style={{ paddingLeft: `${indent + 24}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={13} className="text-gray-500 shrink-0" />
          <span
            className="text-sm font-medium text-gray-200 truncate"
            title={doc.filename}
          >
            {doc.filename}
          </span>
          <span className="text-xs text-gray-600 uppercase shrink-0">
            {doc.file_type || "unknown"}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full
                           ${getStatusBadgeClass(doc.status)}`}
          >
            {doc.status}
          </span>
          <button
            onClick={() => handleDetach(doc)}
            className="text-red-400 hover:text-red-300 text-xs font-medium
                       transition-colors opacity-0 group-hover:opacity-100"
          >
            Remove
          </button>
        </div>
      </div>
    );
  };

  // ── Recursive folder node renderer ────────────────────────────────────────
  const renderFolderNode = (
    node: FolderTreeNode,
    depth = 0,
  ): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const fullySel = isFolderFullySelected(node.path);
    const partiallySel = isFolderPartiallySelected(node.path);
    const indent = depth * 16;

    return (
      <div key={node.id}>
        {/* Folder row */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800
                     border-b border-gray-700/30"
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          {/* Folder checkbox — supports indeterminate state */}
          <input
            type="checkbox"
            checked={fullySel}
            ref={(el) => {
              if (el) el.indeterminate = partiallySel;
            }}
            onChange={() => toggleFolder(node.path)}
            className="accent-blue-500 cursor-pointer"
          />

          {/* Expand/collapse chevron */}
          <span
            className="text-gray-500 cursor-pointer"
            onClick={() =>
              setExpandedPaths((prev) => {
                const next = new Set(prev);
                if (next.has(node.path)) {
                  next.delete(node.path);
                } else {
                  next.add(node.path);
                }
                return next;
              })
            }
          >
            {isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </span>

          {/* Folder icon */}
          {isExpanded ? (
            <FolderOpen size={14} className="text-yellow-400 shrink-0" />
          ) : (
            <FolderIcon size={14} className="text-yellow-400 shrink-0" />
          )}

          {/* Folder name — click to expand/collapse */}
          <span
            className="text-sm font-medium text-gray-200 cursor-pointer select-none"
            onClick={() =>
              setExpandedPaths((prev) => {
                const next = new Set(prev);
                if (next.has(node.path)) {
                  next.delete(node.path);
                } else {
                  next.add(node.path);
                }
                return next;
              })
            }
          >
            {node.name}
          </span>
        </div>

        {/* Children — recursive */}
        {isExpanded && (
          <div>
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
            {node.documents.map((doc) => renderDocRow(doc, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ── Document row renderer ─────────────────────────────────────────────────
  const renderDocRow = (doc: Document, depth = 0): React.ReactNode => {
    const indent = depth * 16;
    return (
      <div
        key={doc.id}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800
                   border-b border-gray-700/20 cursor-pointer"
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => toggleDoc(doc.id)}
      >
        <input
          type="checkbox"
          checked={selectedIds.has(doc.id)}
          onChange={() => toggleDoc(doc.id)}
          onClick={(e) => e.stopPropagation()}
          className="accent-blue-500 cursor-pointer"
        />
        <FileText size={13} className="text-gray-500 shrink-0" />
        <span className="text-sm text-gray-300 truncate flex-1">
          {doc.filename}
        </span>
        <span className="text-xs text-gray-600 uppercase shrink-0">
          {doc.file_type}
        </span>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* ── Header + Tabs ──────────────────────────────────────────────────── */}
      <div className="px-4 border-b border-gray-700 flex items-center gap-4 shrink-0">
        {/* Workspace name + description */}
        <div className="flex items-center gap-2 py-2 shrink-0">
          <h2 className="text-sm font-semibold text-gray-100">
            {workspace.name}
          </h2>
          {workspace.description && (
            <span
              className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5
                         rounded-full border border-gray-700 max-w-50 truncate"
              title={workspace.description}
            >
              {workspace.description}
            </span>
          )}
        </div>

        {/* Divider */}
        <span className="text-gray-700 text-lg">|</span>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2
              ${
                activeTab === "chat"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2
              flex items-center gap-1.5
              ${
                activeTab === "documents"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
          >
            Documents
            {attachedDocs.length > 0 && (
              <span
                className="bg-gray-700 text-gray-300 text-xs
                           px-1.5 py-0.5 rounded-full leading-none"
              >
                {attachedDocs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("workflows")}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2
              flex items-center gap-1.5
              ${
                activeTab === "workflows"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
          >
            <Bot size={14} />
            Workflows
          </button>
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Chat tab */}
        <div
          className={activeTab === "chat" ? "flex-1 overflow-hidden" : "hidden"}
        >
          <ChatPanel
            workspaceId={workspace.id}
            showToast={showToast}
            activeSessionId={activeSessionId}
            onSessionChange={onSessionChange}
            workspaceDocs={attachedDocs}
            workspaceFolders={folders}
          />
        </div>

        {/* Workflows tab */}
        {activeTab === "workflows" && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <SwtbotWorkflow />
          </div>
        )}

        {/* Documents tab */}
        {activeTab === "documents" && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="flex flex-col gap-6">
              <div className="bg-gray-900 shadow rounded-lg border border-gray-700 overflow-hidden">
                {/* Documents header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                  <h3 className="font-semibold text-gray-200">
                    Attached Documents
                  </h3>
                  <button
                    onClick={() => setShowAttachModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white
                               text-sm px-3 py-1.5 rounded transition-colors"
                  >
                    + Attach Documents
                  </button>
                </div>

                {/* Attached docs table */}
                {attachedDocs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No documents attached yet. Click "Attach Documents" to add
                    from the Knowledge Base.
                  </div>
                ) : (
                  <div>
                    {attachedRootFolders.map((node) =>
                      renderAttachedFolderNode(node, 0),
                    )}
                    {attachedRootDocuments.map((doc) =>
                      renderAttachedDocRow(doc, 0),
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ATTACH MODAL ───────────────────────────────────────────────────── */}
      {showAttachModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-75"
        >
          <div
            className="bg-gray-900 rounded-lg shadow-xl w-full max-w-lg
                          mx-4 border border-gray-700 flex flex-col max-h-[80vh]"
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4
                            border-b border-gray-700 shrink-0"
            >
              <h2 className="text-gray-100 text-lg font-semibold">
                Attach from Knowledge Base
              </h2>
              {selectedIds.size > 0 && (
                <span
                  className="text-xs text-blue-400 bg-blue-900/40
                                 px-2 py-1 rounded-full"
                >
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            {/* Folder tree */}
            <div className="flex-1 overflow-y-auto border-b border-gray-700">
              {rootFolders.length === 0 && rootDocuments.length === 0 ? (
                <p className="text-gray-400 text-sm py-8 text-center">
                  No completed documents available to attach.
                </p>
              ) : (
                <div>
                  {rootFolders.map((node) => renderFolderNode(node, 0))}
                  {rootDocuments.map((doc) => renderDocRow(doc, 0))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-between items-center px-6 py-4 shrink-0">
              <button
                onClick={() => setShowAttachModal(false)}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-600
                           rounded hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAttach}
                disabled={selectedIds.size === 0 || attaching}
                className="px-4 py-2 text-sm font-medium bg-blue-600
                           hover:bg-blue-700 text-white rounded transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {attaching
                  ? "Attaching..."
                  : `Attach${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
