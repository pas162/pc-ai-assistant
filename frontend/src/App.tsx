import { useState } from "react";
import WorkspaceList from "./components/WorkspaceList";
import KnowledgeBase from "./components/KnowledgeBase";
import WorkspaceDetail from "./components/WorkspaceDetail";
import { ToastContainer } from "./components/Toast"; // component
import { useToast } from "./hooks/useToast"; // hook
import type { Workspace } from "./api";

function App() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );
  const { toasts, showToast, removeToast } = useToast();

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* ── TOP NAVBAR ──────────────────────────────────────────── */}
      <div className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3 shrink-0">
        {/* App title - left side */}
        <span className="text-white font-bold text-sm">🤖 PC AI Assistant</span>

        {/* Separator + current location - shows breadcrumb */}
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
            <span className="text-white font-medium">📚 Knowledge Base</span>
          )}
        </span>
      </div>
      {/* ── BODY (sidebar + content) ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="w-64 bg-gray-900 text-white flex flex-col">
          <WorkspaceList
            selectedWorkspaceId={selectedWorkspace?.id ?? null}
            onSelectWorkspace={setSelectedWorkspace}
            showToast={showToast}
          />

          <div className="p-3 border-t border-gray-700">
            <button
              onClick={() => setSelectedWorkspace(null)}
              className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors
                ${
                  selectedWorkspace === null
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
            >
              📚 Knowledge Base
            </button>
          </div>
        </div>
        {/* RIGHT CONTENT AREA */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {selectedWorkspace === null ? (
              <KnowledgeBase showToast={showToast} />
            ) : (
              <WorkspaceDetail
                workspace={selectedWorkspace}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      </div>

      {/* Toast container — renders toasts on top of everything */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
