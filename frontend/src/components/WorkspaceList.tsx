import { useEffect, useState, useRef } from "react";
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "../api";
import type { Workspace } from "../api";

// ← 1. Define what props this component accepts
// Think of this like a Java method signature
interface WorkspaceListProps {
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
}

// ← 2. Accept the props as a parameter
export default function WorkspaceList({
  selectedWorkspaceId,
  onSelectWorkspace,
}: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // "..." menu state — stores which workspace's menu is currently open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Fetch ────────────────────────────────────────────

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

  // Close "..." menu when user clicks anywhere outside it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Create ───────────────────────────────────────────

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
    } catch {
      alert("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────

  const openEditModal = (ws: Workspace) => {
    setEditingWorkspace(ws);
    setEditName(ws.name); // pre-fill current name
    setEditDescription(ws.description ?? ""); // pre-fill current description
    setShowEditModal(true);
    setOpenMenuId(null); // close the "..." menu
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
    } catch {
      alert("Failed to update workspace");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────

  const handleDelete = async (ws: Workspace) => {
    if (!window.confirm(`Delete "${ws.name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkspace(ws.id);
      setOpenMenuId(null);
      await fetchWorkspaces();
    } catch {
      alert("Failed to delete workspace");
    }
  };

  // ── Render ───────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Workspaces
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="text-gray-400 hover:text-white text-xl font-bold leading-none"
          title="New Workspace"
        >
          +
        </button>
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <p className="text-gray-400 text-sm px-4 py-2">Loading...</p>
        )}
        {error && <p className="text-red-400 text-sm px-4 py-2">{error}</p>}
        {!loading && !error && workspaces.length === 0 && (
          <p className="text-gray-500 text-sm px-4 py-2">No workspaces yet.</p>
        )}

        {workspaces.map((ws: Workspace) => (
          <div
            key={ws.id}
            onClick={() => onSelectWorkspace(ws)}
            className={`group flex items-center justify-between px-4 py-2 rounded mx-2 cursor-pointer
              ${
                selectedWorkspaceId === ws.id
                  ? "bg-blue-600"
                  : "hover:bg-gray-700"
              }`}
          >
            {/* Name + description */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {ws.name}
              </p>
              {ws.description && (
                <p className="text-gray-400 text-xs mt-0.5 truncate">
                  {ws.description}
                </p>
              )}
            </div>

            {/* "..." button — only visible on hover */}
            <div
              className="relative"
              ref={openMenuId === ws.id ? menuRef : null}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation(); // prevent row click from firing
                  setOpenMenuId(openMenuId === ws.id ? null : ws.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400
                           hover:text-white px-1 rounded transition-opacity"
                title="Options"
              >
                ⋮
              </button>

              {/* Dropdown menu */}
              {openMenuId === ws.id && (
                <div
                  className="absolute right-0 top-6 z-10 bg-white rounded
                                shadow-lg border border-gray-200 py-1 w-36"
                >
                  <button
                    onClick={() => openEditModal(ws)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700
                               hover:bg-gray-100"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(ws)}
                    className="w-full text-left px-4 py-2 text-sm text-red-600
                               hover:bg-red-50"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── CREATE MODAL ──────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-gray-900 text-lg font-semibold mb-4">
              New Workspace
            </h2>

            <label className="block text-gray-700 text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. HR Documents"
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900
                         placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500 mb-4"
              autoFocus
            />

            <label className="block text-gray-700 text-sm font-medium mb-1">
              Description{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900
                         placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500 mb-6"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewName("");
                  setNewDescription("");
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900
                           border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded
                           hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ────────────────────────────────── */}
      {showEditModal && editingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-gray-900 text-lg font-semibold mb-4">
              Edit Workspace
            </h2>

            <label className="block text-gray-700 text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900
                         placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500 mb-4"
              autoFocus
            />

            <label className="block text-gray-700 text-sm font-medium mb-1">
              Description{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900
                         placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500 mb-6"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingWorkspace(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900
                           border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={!editName.trim() || saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded
                           hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
