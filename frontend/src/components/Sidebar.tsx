import { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Settings,
  Database,
} from "lucide-react";
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "../api";
import type { Workspace, ChatSession, ChatSessionDetail } from "../api";
import type { ToastType } from "../hooks/useToast";
import { Modal, ConfirmModal } from "./Modal";

interface SidebarProps {
  selectedWorkspace: Workspace | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onWorkspaceDeleted: (id: string) => void;
  showToast: (msg: string, type: ToastType) => void;
  // Sessions
  sessions: ChatSession[];
  activeSession: ChatSessionDetail | null;
  loadingSessions: boolean;
  onNewSession: () => void;
  onSelectSession: (s: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  // Active view (KB / Settings)
  activeView: "kb" | "settings" | null;
  onSelectView: (view: "kb" | "settings") => void;
}

export default function Sidebar({
  selectedWorkspace,
  onSelectWorkspace,
  onWorkspaceDeleted,
  showToast,
  sessions,
  activeSession,
  loadingSessions,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  activeView,
  onSelectView,
}: SidebarProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWs, setLoadingWs] = useState(true);
  const [workspacesOpen, setWorkspacesOpen] = useState(true);

  // Workspace CRUD modals
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Workspace | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] =
    useState<ChatSession | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchWorkspaces = async () => {
    try {
      setLoadingWs(true);
      setWorkspaces(await getWorkspaces());
    } catch {
      showToast("Failed to load workspaces", "error");
    } finally {
      setLoadingWs(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await createWorkspace({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      await fetchWorkspaces();
      showToast("Workspace created", "success");
    } catch {
      showToast("Failed to create workspace", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingWs || !editName.trim()) return;
    try {
      setSaving(true);
      await updateWorkspace(editingWs.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setEditingWs(null);
      await fetchWorkspaces();
      showToast("Workspace updated", "success");
    } catch {
      showToast("Failed to update workspace", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ws: Workspace) => {
    try {
      await deleteWorkspace(ws.id);
      setConfirmDelete(null);
      await fetchWorkspaces();
      onWorkspaceDeleted(ws.id);
      showToast("Workspace deleted", "info");
    } catch {
      showToast("Failed to delete workspace", "error");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900 select-none">

      {/* ── App title ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-gray-800 shrink-0 flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">P</span>
        </div>
        <span className="text-gray-300 text-xs font-semibold tracking-wide">
          PC AI Assistant
        </span>
      </div>

      {/* ── Scrollable nav body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 custom-scrollbar">

        {/* ── WORKSPACES section ── */}
        <div className="px-2">
          {/* Section header */}
          <div className="flex items-center justify-between px-2 py-1 group">
            <button
              onClick={() => setWorkspacesOpen((o) => !o)}
              className="flex items-center gap-1 text-xs font-semibold
                         text-gray-500 uppercase tracking-wider
                         hover:text-gray-300 transition-colors"
            >
              {workspacesOpen
                ? <ChevronDown size={12} />
                : <ChevronRight size={12} />}
              Workspaces
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity
                         text-gray-500 hover:text-gray-200 rounded p-0.5"
              title="New workspace"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Workspace rows */}
          {workspacesOpen && (
            <div className="mt-0.5 space-y-0.5">
              {loadingWs ? (
                <div className="space-y-1 px-2 py-1">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-7 rounded bg-gray-800 animate-pulse"
                      style={{ opacity: 1 - i * 0.3 }}
                    />
                  ))}
                </div>
              ) : workspaces.length === 0 ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full text-left px-2 py-1.5 text-xs text-gray-600
                             hover:text-gray-400 transition-colors rounded"
                >
                  + New workspace
                </button>
              ) : (
                workspaces.map((ws) => {
                  const isActive = selectedWorkspace?.id === ws.id;
                  return (
                    <div key={ws.id} className="relative">
                      <button
                        onClick={() => onSelectWorkspace(ws)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5
                                   rounded text-left transition-colors group/ws
                                   ${isActive
                                     ? "bg-blue-600/20 text-blue-300"
                                     : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                                   }`}
                      >
                        <FolderOpen
                          size={14}
                          className={`shrink-0 ${isActive ? "text-blue-400" : "text-gray-600"}`}
                        />
                        <span className="flex-1 text-xs font-medium truncate">
                          {ws.name}
                        </span>
                        {ws.documents?.length > 0 && (
                          <span className="text-xs text-gray-600 shrink-0">
                            {ws.documents.length}
                          </span>
                        )}
                        {/* ⋮ context menu button */}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === ws.id ? null : ws.id);
                          }}
                          className="opacity-0 group-hover/ws:opacity-100 transition-opacity
                                     text-gray-500 hover:text-gray-300 p-0.5 rounded shrink-0"
                        >
                          <MoreVertical size={13} />
                        </span>
                      </button>

                      {/* Context menu */}
                      {openMenuId === ws.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-7 z-50 bg-gray-800 border
                                     border-gray-700 rounded-lg shadow-xl py-1 w-36"
                        >
                          <button
                            onClick={() => {
                              setEditingWs(ws);
                              setEditName(ws.name);
                              setEditDesc(ws.description ?? "");
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2
                                       text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(ws);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2
                                       text-xs text-red-400 hover:bg-gray-700 transition-colors"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}

                      {/* ── Inline sessions for the active workspace ── */}
                      {isActive && (
                        <div className="ml-4 mt-0.5 border-l border-gray-800 pl-2 space-y-0.5">
                          {/* New chat button */}
                          <button
                            onClick={onNewSession}
                            className="w-full flex items-center gap-1.5 px-2 py-1
                                       text-xs text-gray-600 hover:text-blue-400
                                       hover:bg-gray-800 rounded transition-colors"
                          >
                            <Plus size={11} />
                            New chat
                          </button>

                          {/* Session list */}
                          {loadingSessions ? (
                            <div className="space-y-1 py-1">
                              {[1, 2].map((i) => (
                                <div
                                  key={i}
                                  className="h-6 rounded bg-gray-800 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : sessions.length === 0 ? (
                            <p className="text-xs text-gray-700 px-2 py-1">
                              No chats yet
                            </p>
                          ) : (
                            sessions.map((s) => {
                              const isActiveSession =
                                activeSession?.id === s.id;
                              return (
                                <div
                                  key={s.id}
                                  className={`group/session flex items-center gap-1.5
                                             px-2 py-1 rounded cursor-pointer
                                             transition-colors
                                             ${isActiveSession
                                               ? "bg-blue-600/30 text-blue-200"
                                               : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                                             }`}
                                  onClick={() => onSelectSession(s)}
                                >
                                  <MessageSquare
                                    size={10}
                                    className="shrink-0 text-gray-600"
                                  />
                                  <span className="flex-1 text-xs truncate">
                                    {s.title}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteSession(s);
                                    }}
                                    className="opacity-0 group-hover/session:opacity-100
                                               transition-opacity text-gray-600
                                               hover:text-red-400 shrink-0"
                                    title="Delete"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav: KB + Settings ─────────────────────────────────────── */}
      <div className="border-t border-gray-800 py-1 px-2 space-y-0.5 shrink-0">
        <button
          onClick={() => onSelectView("kb")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded
                     text-xs transition-colors
                     ${activeView === "kb"
                       ? "bg-gray-700 text-gray-100"
                       : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                     }`}
        >
          <Database size={13} />
          Knowledge Base
        </button>
        <button
          onClick={() => onSelectView("settings")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded
                     text-xs transition-colors
                     ${activeView === "settings"
                       ? "bg-gray-700 text-gray-100"
                       : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                     }`}
        >
          <Settings size={13} />
          Settings
        </button>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal
          title="New Workspace"
          onClose={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
        >
          <label className="block text-gray-400 text-sm font-medium mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Sprint Planning"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                       text-gray-200 placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500 mb-4 text-sm"
          />
          <label className="block text-gray-400 text-sm font-medium mb-1">
            Description <span className="text-gray-600 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="What is this workspace for?"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                       text-gray-200 placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500 mb-6 text-sm"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-600
                         rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded
                         hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </Modal>
      )}

      {editingWs && (
        <Modal
          title="Edit Workspace"
          onClose={() => setEditingWs(null)}
        >
          <label className="block text-gray-400 text-sm font-medium mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                       text-gray-200 focus:outline-none focus:ring-2
                       focus:ring-blue-500 mb-4 text-sm"
          />
          <label className="block text-gray-400 text-sm font-medium mb-1">
            Description <span className="text-gray-600 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
            placeholder="What is this workspace for?"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                       text-gray-200 placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500 mb-6 text-sm"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setEditingWs(null)}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-600
                         rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={!editName.trim() || saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded
                         hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmDeleteSession && (
        <ConfirmModal
          message={`Delete "${confirmDeleteSession.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            onDeleteSession(confirmDeleteSession.id);
            setConfirmDeleteSession(null);
          }}
          onCancel={() => setConfirmDeleteSession(null)}
        />
      )}
    </div>
  );
}
