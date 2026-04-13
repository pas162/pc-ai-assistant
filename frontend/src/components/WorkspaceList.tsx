import { useEffect, useState, useRef } from "react";
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "../api";
import type { Workspace } from "../api";
import type { ToastType } from "../hooks/useToast";
import { FolderOpen, MoreVertical, Pencil, Trash2, Plus } from "lucide-react";
interface WorkspaceListProps {
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  showToast: (message: string, type: ToastType) => void;
}

export default function WorkspaceList({
  selectedWorkspaceId,
  onSelectWorkspace,
  showToast,
}: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await getWorkspaces();
      setWorkspaces(data);
    } catch {
      setError("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await createWorkspace({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewDescription("");
      setShowModal(false);
      await fetchWorkspaces();
      showToast("Workspace created!", "success");
    } catch {
      showToast("Failed to create workspace", "error");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (ws: Workspace) => {
    setEditingWorkspace(ws);
    setEditName(ws.name);
    setEditDescription(ws.description ?? "");
    setShowEditModal(true);
    setOpenMenuId(null);
  };

  const handleUpdate = async () => {
    if (!editingWorkspace || !editName.trim()) return;
    try {
      setSaving(true);
      await updateWorkspace(editingWorkspace.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setShowEditModal(false);
      setEditingWorkspace(null);
      await fetchWorkspaces();
      showToast("Workspace updated!", "success");
    } catch {
      showToast("Failed to update workspace", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ws: Workspace) => {
    if (!window.confirm(`Delete "${ws.name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkspace(ws.id);
      setOpenMenuId(null);
      await fetchWorkspaces();
      showToast("Workspace deleted", "info");
    } catch {
      showToast("Failed to delete workspace", "error");
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header — full row is clickable, bottom border acts as separator */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center justify-between px-3 py-2 border-b border-gray-700
                   w-full hover:bg-gray-800 transition-colors group shrink-0"
        title="New Workspace"
      >
        <span
          className="text-xs font-semibold text-gray-400 uppercase tracking-wide
                         group-hover:text-gray-200 transition-colors"
        >
          Workspaces
        </span>
        <Plus
          size={15}
          className="text-gray-400 group-hover:text-white transition-colors"
        />
      </button>

      {/* Workspace list — no extra separator needed, button border-b handles it */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <p className="text-gray-500 text-xs px-4 py-2">Loading...</p>
        )}
        {error && <p className="text-red-400 text-xs px-4 py-2">{error}</p>}
        {!loading && !error && workspaces.length === 0 && (
          <p className="text-gray-600 text-xs px-4 py-2">No workspaces yet.</p>
        )}

        {workspaces.map((ws) => (
          <div
            key={ws.id}
            onClick={() => onSelectWorkspace(ws)}
            className={`group flex items-center justify-between px-3 py-2
              rounded mx-2 cursor-pointer transition-colors
              ${selectedWorkspaceId === ws.id ? "bg-blue-600" : "hover:bg-gray-800"}`}
          >
            {/* Name + doc count — no icon */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1">
                <FolderOpen size={14} className="shrink-0 text-blue-400" />
                {ws.name}
              </p>
              {ws.documents && ws.documents.length > 0 && (
                <p
                  className={`text-xs truncate
                  ${selectedWorkspaceId === ws.id ? "text-blue-200" : "text-gray-600"}`}
                >
                  {ws.documents.length}{" "}
                  {ws.documents.length === 1 ? "doc" : "docs"}
                </p>
              )}
            </div>

            {/* ⋮ menu — keep the ⋮ character, it's punctuation not emoji */}
            <div
              className="relative"
              ref={openMenuId === ws.id ? menuRef : null}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === ws.id ? null : ws.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400
                           hover:text-white px-1 rounded transition-opacity"
              >
                <MoreVertical size={16} />
              </button>

              {openMenuId === ws.id && (
                <div
                  className="absolute right-0 top-6 z-10 bg-gray-800 rounded
                                shadow-lg border border-gray-700 py-1 w-32"
                >
                  <button
                    onClick={() => openEditModal(ws)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300
                               hover:bg-gray-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Pencil size={13} /> Edit
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(ws)}
                    className="w-full text-left px-4 py-2 text-sm text-red-400
                               hover:bg-gray-700 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-red-400">
                      <Trash2 size={13} /> Delete
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── CREATE MODAL ──────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 border border-gray-700">
            <h2 className="text-gray-100 text-lg font-semibold mb-4">
              New Workspace
            </h2>

            <label className="block text-gray-400 text-sm font-medium mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. HR Documents"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                         text-gray-200 placeholder-gray-500 focus:outline-none
                         focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />

            <label className="block text-gray-400 text-sm font-medium mb-1">
              Description{" "}
              <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                         text-gray-200 placeholder-gray-500 focus:outline-none
                         focus:ring-2 focus:ring-blue-500 mb-6"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewName("");
                  setNewDescription("");
                }}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-600
                           rounded hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded
                           hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ────────────────────────────────── */}
      {showEditModal && editingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 border border-gray-700">
            <h2 className="text-gray-100 text-lg font-semibold mb-4">
              Edit Workspace
            </h2>

            <label className="block text-gray-400 text-sm font-medium mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                         text-gray-200 placeholder-gray-500 focus:outline-none
                         focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />

            <label className="block text-gray-400 text-sm font-medium mb-1">
              Description{" "}
              <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2
                         text-gray-200 placeholder-gray-500 focus:outline-none
                         focus:ring-2 focus:ring-blue-500 mb-6"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingWorkspace(null);
                }}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-600
                           rounded hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={!editName.trim() || saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded
                           hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
