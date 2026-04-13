import { useState } from "react";
import WorkspaceList from "./components/WorkspaceList";
import KnowledgeBase from "./components/KnowledgeBase";
import WorkspaceDetail from "./components/WorkspaceDetail";
import { ToastContainer } from "./components/Toast";
import { useToast } from "./hooks/useToast";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Workspace } from "./api";

function App() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );
  const { toasts, showToast, removeToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Remember the last active session ID per workspace ──────────────────────
  // Key: workspaceId, Value: sessionId
  // This survives workspace switches because it lives in App, not ChatPanel
  const [activeSessionIds, setActiveSessionIds] = useState<
    Record<string, string>
  >({});

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
  };

  const handleSessionChange = (workspaceId: string, sessionId: string) => {
    setActiveSessionIds((prev) => ({ ...prev, [workspaceId]: sessionId }));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* ── TOP NAVBAR ──────────────────────────────────────────── */}
      <div className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="text-gray-400 hover:text-white transition-colors p-1.5
                     rounded hover:bg-gray-700"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>

        <span className="text-white font-bold text-sm">PC AI Assistant</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 text-sm">
          {selectedWorkspace ? (
            <>
              <span className="text-gray-500">Workspace</span>
              <span className="text-gray-500"> › </span>
              <span className="text-white font-medium">
                {selectedWorkspace.name}
              </span>
            </>
          ) : (
            <span className="text-white font-medium">Knowledge Base</span>
          )}
        </span>
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`bg-gray-900 border-r border-gray-700 text-white 
                      flex flex-col transition-all duration-300 overflow-hidden
                      ${sidebarOpen ? "w-64" : "w-0"}`}
        >
          <WorkspaceList
            selectedWorkspaceId={selectedWorkspace?.id ?? null}
            onSelectWorkspace={handleSelectWorkspace}
            showToast={showToast}
          />
          <div className="p-3 border-t border-gray-700">
            <button
              onClick={() => setSelectedWorkspace(null)}
              className={`w-full text-left px-3 py-2 rounded text-sm 
                font-medium transition-colors
                ${
                  selectedWorkspace === null
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
            >
              Knowledge Base
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
          <div className="flex-1 overflow-y-auto">
            {selectedWorkspace === null ? (
              <KnowledgeBase showToast={showToast} />
            ) : (
              <WorkspaceDetail
                workspace={selectedWorkspace}
                showToast={showToast}
                // ── Pass the remembered session ID for this workspace ──
                activeSessionId={activeSessionIds[selectedWorkspace.id] ?? null}
                onSessionChange={handleSessionChange}
              />
            )}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
