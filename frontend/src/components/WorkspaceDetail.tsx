import { useState, useEffect, useMemo } from "react";
import {
  getDocuments,
  getFolders,
  unlinkDocumentFromWorkspace,
  bulkLinkDocumentsToWorkspace,
} from "../api";
import type { Workspace, Document, Folder, ChatSession, ChatSessionDetail } from "../api";
import type { ToastType } from "../hooks/useToast";
import ChatPanel from "./chat/ChatPanel";
import { SwtbotWorkflow } from "./workflows";
import { ConfirmModal } from "./Modal";
import { useChatSessions } from "./chat/useChatSessions";
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  Bot,
  Link,
  Unlink,
} from "lucide-react";

function stripUuid(filename: string): string {
  return filename.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/,
    "",
  );
}

function getStatusDot(status: string) {
  const m: Record<string, { dot: string; text: string; label: string }> = {
    completed:  { dot: "bg-green-500",              text: "text-green-400",  label: "completed" },
    processing: { dot: "bg-blue-400 animate-pulse", text: "text-blue-400",  label: "processing" },
    failed:     { dot: "bg-red-500",                text: "text-red-400",   label: "failed" },
    pending:    { dot: "bg-yellow-500",             text: "text-yellow-400",label: "pending" },
  };
  return m[status] ?? m.pending;
}

function getTypeBadge(fileType: string | null) {
  const m: Record<string, { bg: string; text: string }> = {
    pdf:  { bg: "bg-red-500/15",    text: "text-red-400" },
    docx: { bg: "bg-blue-500/15",   text: "text-blue-400" },
    xlsx: { bg: "bg-green-500/15",  text: "text-green-400" },
    java: { bg: "bg-orange-500/15", text: "text-orange-400" },
    py:   { bg: "bg-yellow-500/15", text: "text-yellow-400" },
    ts:   { bg: "bg-cyan-500/15",   text: "text-cyan-400" },
    js:   { bg: "bg-cyan-500/15",   text: "text-cyan-400" },
    xml:  { bg: "bg-purple-500/15", text: "text-purple-400" },
    md:   { bg: "bg-gray-500/15",   text: "text-gray-300" },
  };
  return (fileType ? m[fileType] : undefined) ?? { bg: "bg-gray-700/50", text: "text-gray-500" };
}

interface WorkspaceDetailProps {
  workspace: Workspace;
  showToast: (message: string, type: ToastType) => void;
  activeSessionId: string | null;
  onSessionChange: (workspaceId: string, sessionId: string) => void;
  onSessionsUpdate?: (
    sessions: ChatSession[],
    active: ChatSessionDetail | null,
    loading: boolean,
    actions?: {
      newSession: () => void;
      selectSession: (s: ChatSession) => void;
      deleteSession: (id: string) => void;
    }
  ) => void;
}

type Tab = "chat" | "documents" | "workflows";

// ΓöÇΓöÇ Folder tree node type ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
  onSessionsUpdate,
}: WorkspaceDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // ΓöÇΓöÇ Session management (lifted here so Sidebar can observe it) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const {
    sessions,
    setSessions,
    activeSession,
    setActiveSession,
    loadingSessions,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
  } = useChatSessions({
    workspaceId: workspace.id,
    activeSessionId,
    onSessionChange,
    showToast,
  });

  // Notify App whenever session state changes, passing real action handlers
  useEffect(() => {
    onSessionsUpdate?.(sessions, activeSession, loadingSessions, {
      newSession: handleNewSession,
      selectSession: handleSelectSession,
      deleteSession: handleDeleteSession,
    });
  }, [sessions, activeSession, loadingSessions, onSessionsUpdate,
      handleNewSession, handleSelectSession, handleDeleteSession]);
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
  const [confirmDetach, setConfirmDetach] = useState<Document | null>(null);

  // ΓöÇΓöÇ Sync attached docs when workspace changes ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    setAttachedDocs(workspace.documents);
    setActiveTab("chat");
  }, [workspace.id, workspace.documents]);

  // ΓöÇΓöÇ Fetch folders on mount so attached tree has structure ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    getFolders()
      .then(setFolders)
      .catch(() => {});
  }, []);

  // ΓöÇΓöÇ Fetch all docs + folders when modal opens ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Build folder tree from flat lists ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  // WHY useMemo? This recalculates only when docs, folders, or attachedDocs
  // change ΓÇö not on every render. Tree assembly is O(n) but still worth caching.
  const { rootFolders, rootDocuments } = useMemo(() => {
    // Only show unattached + completed docs in the modal
    const available = allDocuments.filter(
      (doc) =>
        doc.status === "completed" &&
        !attachedDocs.some((a) => a.id === doc.id),
    );

    // Step 1 ΓÇö build path ΓåÆ node map
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

    // Step 2 ΓÇö link children to parents
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

    // Step 3 ΓÇö attach documents to their folder node
    const rootDocuments: Document[] = [];
    for (const doc of available) {
      if (!doc.folder_path) {
        rootDocuments.push(doc);
      } else {
        const node = nodeMap.get(doc.folder_path);
        if (node) node.documents.push(doc);
        else rootDocuments.push(doc); // orphan ΓåÆ show at root
      }
    }

    // Step 4 ΓÇö sort alphabetically
    rootFolders.sort((a, b) => a.name.localeCompare(b.name));
    rootDocuments.sort((a, b) => a.filename.localeCompare(b.filename));

    return { rootFolders, rootDocuments };
  }, [allDocuments, folders, attachedDocs]);

  // ΓöÇΓöÇ Attached docs tree ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Selection helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Bulk Attach ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Detach single doc ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const handleDetach = async (doc: Document) => {
    try {
      await unlinkDocumentFromWorkspace(workspace.id, doc.id);
      setAttachedDocs((prev) => prev.filter((d) => d.id !== doc.id));
      setConfirmDetach(null);
      showToast(`"${doc.filename}" removed`, "info");
    } catch {
      showToast("Failed to detach document", "error");
    }
  };

  // ΓöÇΓöÇ Status badge ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  // ΓöÇΓöÇ Attached folder node renderer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
    const sd = getStatusDot(doc.status);
    const tb = getTypeBadge(doc.file_type);
    return (
      <div
        key={doc.id}
        className="flex items-center gap-3 px-4 py-2.5
                   hover:bg-gray-800/60 transition-colors border-b
                   border-gray-800/60 last:border-0 group"
        style={{ paddingLeft: `${indent + 16}px` }}
      >
        <FileText size={13} className="text-gray-600 shrink-0" />
        <span className="flex-1 text-sm text-gray-300 truncate min-w-0" title={doc.filename}>
          {stripUuid(doc.filename)}
        </span>
        <span className={`shrink-0 text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${tb.bg} ${tb.text}`}>
          {doc.file_type ?? "?"}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${sd.dot}`} />
          <span className={`text-xs ${sd.text}`}>{sd.label}</span>
        </div>
        <button
          onClick={() => setConfirmDetach(doc)}
          title="Remove from workspace"
          className="text-gray-700 hover:text-red-400 transition-colors
                     opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Unlink size={13} />
        </button>
      </div>
    );
  };

  // ΓöÇΓöÇ Recursive folder node renderer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
          {/* Folder checkbox ΓÇö supports indeterminate state */}
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

          {/* Folder name ΓÇö click to expand/collapse */}
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

        {/* Children ΓÇö recursive */}
        {isExpanded && (
          <div>
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
            {node.documents.map((doc) => renderDocRow(doc, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ΓöÇΓöÇ Document row renderer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Main render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* ΓöÇΓöÇ Tab bar ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className="px-3 border-b border-gray-800 flex items-center gap-0.5 shrink-0 bg-gray-950">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center px-3 py-2.5 text-xs font-medium
            transition-colors border-b-2 -mb-px
            ${activeTab === "chat"
              ? "border-blue-500 text-gray-100"
              : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
        >
          Chat
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium
            transition-colors border-b-2 -mb-px
            ${activeTab === "documents"
              ? "border-blue-500 text-gray-100"
              : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
        >
          Documents
          {attachedDocs.length > 0 && (
            <span className="bg-gray-800 text-gray-400 text-xs px-1.5 py-0.5 rounded-full leading-none">
              {attachedDocs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("workflows")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium
            transition-colors border-b-2 -mb-px
            ${activeTab === "workflows"
              ? "border-blue-500 text-gray-100"
              : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
        >
          <Bot size={13} />
          Workflows
        </button>
      </div>

      {/* ΓöÇΓöÇ Tab Content ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Chat tab */}
        <div
          className={activeTab === "chat" ? "flex-1 overflow-hidden" : "hidden"}
        >
          <ChatPanel
            showToast={showToast}
            activeSession={activeSession}
            setActiveSession={setActiveSession}
            setSessions={setSessions}
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
              <div className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900">
                {/* Documents header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <Link size={14} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-200">Attached Documents</span>
                    {attachedDocs.length > 0 && (
                      <span className="bg-gray-800 text-gray-400 text-xs px-1.5 py-0.5 rounded-full">
                        {attachedDocs.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAttachModal(true)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500
                               text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Link size={12} /> Attach Documents
                  </button>
                </div>

                {/* Attached docs list */}
                {attachedDocs.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700
                                    flex items-center justify-center">
                      <Link size={16} className="text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">No documents attached</p>
                    <p className="text-xs text-gray-600">
                      Click "Attach Documents" to add from the Knowledge Base.
                    </p>
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

      {/* ΓöÇΓöÇ ATTACH MODAL ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      {confirmDetach && (
        <ConfirmModal
          message={`Remove "${confirmDetach.filename}" from this workspace?`}
          confirmLabel="Remove"
          onConfirm={() => handleDetach(confirmDetach)}
          onCancel={() => setConfirmDetach(null)}
        />
      )}

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
