import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ImperativePanelHandle } from "react-resizable-panels";
import WorkspaceList from "./components/WorkspaceList";
import KnowledgeBase from "./components/KnowledgeBase";
import WorkspaceDetail from "./components/WorkspaceDetail";
import Settings from "./components/Settings";
import { ToastContainer } from "./components/Toast";
import { useToast } from "./hooks/useToast";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
} from "lucide-react";
import type { Workspace } from "./api";
import { getWorkspaces } from "./api";

function App() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    () => {
      // Restore last selected workspace from localStorage on reload
      try {
        const saved = localStorage.getItem("selectedWorkspace");
        return saved ? (JSON.parse(saved) as Workspace) : null;
      } catch {
        return null;
      }
    },
  );

  // ── Re-fetch workspace on reload to get fresh documents list ─────────────
  useEffect(() => {
    const saved = localStorage.getItem("selectedWorkspace");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Workspace;

      getWorkspaces()
        .then((workspaces) => {
          const fresh = workspaces.find((w) => w.id === parsed.id);
          if (fresh) {
            setSelectedWorkspace(fresh);
          } else {
            // Workspace was deleted — clear localStorage
            localStorage.removeItem("selectedWorkspace");
            setSelectedWorkspace(null);
          }
        })
        .catch(() => {
          localStorage.removeItem("selectedWorkspace");
        });
    } catch {
      // JSON.parse failed — just clean up localStorage silently
      localStorage.removeItem("selectedWorkspace");
      // No setState here — initial useState already defaults to null
    }
  }, []);

  const { toasts, showToast, removeToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSessionIds, setActiveSessionIds] = useState<
    Record<string, string>
  >({});
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);

  // Collapse/expand sidebar imperatively when sidebarOpen changes
  useEffect(() => {
    if (sidebarOpen) {
      sidebarPanelRef.current?.expand();
    } else {
      sidebarPanelRef.current?.collapse();
    }
  }, [sidebarOpen]);

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    localStorage.setItem("selectedWorkspace", JSON.stringify(workspace)); // Save on select
    setShowSettings(false);
  };

  const handleWorkspaceDeleted = (deletedId: string) => {
    // If the deleted workspace is currently open — clear it
    if (selectedWorkspace?.id === deletedId) {
      setSelectedWorkspace(null);
      localStorage.removeItem("selectedWorkspace"); // Clear on delete
    }
  };

  const handleSessionChange = (workspaceId: string, sessionId: string) => {
    setActiveSessionIds((prev) => ({ ...prev, [workspaceId]: sessionId }));
  };

  const breadcrumb = showSettings ? (
    <span className="text-white font-medium">Settings</span>
  ) : selectedWorkspace ? (
    <>
      <span className="text-gray-500">Workspace</span>
      <span className="text-gray-500"> › </span>
      <span className="text-white font-medium">{selectedWorkspace.name}</span>
    </>
  ) : (
    <span className="text-white font-medium">Knowledge Base</span>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* ── TOP NAVBAR ──────────────────────────────────────────── */}
      <div
        className="h-10 bg-gray-900 border-b border-gray-700
                      flex items-center px-3 shrink-0 gap-2"
      >
        {/* Left — sidebar toggle + app title */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="text-gray-500 hover:text-white transition-colors p-1
                     rounded hover:bg-gray-700"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose size={16} />
            ) : (
              <PanelLeftOpen size={16} />
            )}
          </button>
          <span className="text-white font-semibold text-sm">
            PC AI Assistant
          </span>
        </div>

        {/* Divider */}
        <span className="text-gray-700">|</span>

        {/* Middle — breadcrumb + context actions */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-gray-300 text-sm truncate">{breadcrumb}</span>

          {/* Context actions — only show when workspace is open */}
          {selectedWorkspace && !showSettings && (
            <div className="flex items-center gap-1 ml-2">
              <span
                className="text-xs text-gray-600 bg-gray-800
                               px-2 py-0.5 rounded-full border border-gray-700"
              >
                {selectedWorkspace.description || "No description"}
              </span>
            </div>
          )}
        </div>

        {/* Right — settings */}
        <button
          onClick={() => {
            setShowSettings((prev) => !prev);
            setSelectedWorkspace(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs
                      transition-colors shrink-0
                      ${
                        showSettings
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
          title="Settings"
        >
          <SettingsIcon size={14} />
          <span>Settings</span>
        </button>
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <PanelGroup
          direction="horizontal"
          autoSaveId="app-layout"
          className="flex-1 overflow-hidden"
        >
          {/* ── SIDEBAR PANEL — always mounted, collapses to 0 ── */}
          <Panel
            ref={sidebarPanelRef}
            defaultSize={18}
            minSize={12}
            maxSize={35}
            collapsible={true}
            collapsedSize={0}
            onCollapse={() => setSidebarOpen(false)}
            onExpand={() => setSidebarOpen(true)}
            style={{ overflow: "hidden", minWidth: 0 }}
            className="bg-gray-900 border-r border-gray-700 text-white flex flex-col"
          >
            <WorkspaceList
              selectedWorkspaceId={selectedWorkspace?.id ?? null}
              onSelectWorkspace={handleSelectWorkspace}
              onWorkspaceDeleted={handleWorkspaceDeleted}
              showToast={showToast}
            />
            <div className="p-3 border-t border-gray-700">
              <button
                onClick={() => {
                  setSelectedWorkspace(null);
                  localStorage.removeItem("selectedWorkspace"); // Clear on KB click
                  setShowSettings(false);
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm
                      font-medium transition-colors
                      ${
                        selectedWorkspace === null && !showSettings
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                      }`}
              >
                Knowledge Base
              </button>
            </div>
          </Panel>

          <PanelResizeHandle
            hitAreaMargins={{ coarse: 10, fine: 5 }}
            className={`w-1 bg-gray-700 hover:bg-blue-500
                       active:bg-blue-400 transition-colors cursor-col-resize
                       ${!sidebarOpen ? "hidden" : ""}`}
          />

          {/* ── MAIN CONTENT PANEL ── */}
          <Panel className="flex flex-col overflow-hidden bg-gray-950">
            <div className="flex-1 overflow-y-auto h-full">
              {showSettings ? (
                <Settings showToast={showToast} />
              ) : selectedWorkspace === null ? (
                <KnowledgeBase showToast={showToast} />
              ) : (
                <WorkspaceDetail
                  workspace={selectedWorkspace}
                  showToast={showToast}
                  activeSessionId={
                    activeSessionIds[selectedWorkspace.id] ?? null
                  }
                  onSessionChange={handleSessionChange}
                />
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
