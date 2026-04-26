import { useState, useEffect, useCallback, useRef } from "react";
import KnowledgeBase from "./components/KnowledgeBase";
import WorkspaceDetail from "./components/WorkspaceDetail";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import { ToastContainer } from "./components/Toast";
import { useToast } from "./hooks/useToast";
import type { Workspace, ChatSession, ChatSessionDetail } from "./api";
import { getWorkspaces } from "./api";

interface SessionActions {
  newSession: () => void;
  selectSession: (s: ChatSession) => void;
  deleteSession: (id: string) => void;
}

function App() {
  // ── Workspace state ───────────────────────────────────────────────────────
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    () => {
      try {
        const saved = localStorage.getItem("selectedWorkspace");
        return saved ? (JSON.parse(saved) as Workspace) : null;
      } catch {
        return null;
      }
    },
  );

  useEffect(() => {
    const saved = localStorage.getItem("selectedWorkspace");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Workspace;
      getWorkspaces()
        .then((ws) => {
          const fresh = ws.find((w) => w.id === parsed.id);
          if (fresh) setSelectedWorkspace(fresh);
          else {
            localStorage.removeItem("selectedWorkspace");
            setSelectedWorkspace(null);
          }
        })
        .catch(() => localStorage.removeItem("selectedWorkspace"));
    } catch {
      localStorage.removeItem("selectedWorkspace");
    }
  }, []);

  // ── View state ────────────────────────────────────────────────────────────
  const [mainView, setMainView] = useState<"kb" | "settings" | null>(null);

  // ── Session state (lifted so Sidebar can show them) ───────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeSessionIds, setActiveSessionIds] = useState<Record<string, string>>({});

  // ── Ref to real session handlers (populated by WorkspaceDetail) ─────────
  const sessionActionsRef = useRef<SessionActions>({
    newSession: () => {},
    selectSession: () => {},
    deleteSession: () => {},
  });

  const handleSessionsUpdate = useCallback(
    (
      s: ChatSession[],
      active: ChatSessionDetail | null,
      loading: boolean,
      actions?: SessionActions,
    ) => {
      setSessions(s);
      setActiveSession(active);
      setLoadingSessions(loading);
      if (actions) sessionActionsRef.current = actions;
    },
    [],
  );

  const { toasts, showToast, removeToast } = useToast();

  const handleSelectWorkspace = (ws: Workspace) => {
    setSelectedWorkspace(ws);
    localStorage.setItem("selectedWorkspace", JSON.stringify(ws));
    setMainView(null);
    // Reset sessions when switching workspace
    setSessions([]);
    setActiveSession(null);
  };

  const handleWorkspaceDeleted = (id: string) => {
    if (selectedWorkspace?.id === id) {
      setSelectedWorkspace(null);
      localStorage.removeItem("selectedWorkspace");
      setSessions([]);
      setActiveSession(null);
    }
  };

  const handleSelectView = (view: "kb" | "settings") => {
    setMainView((prev) => (prev === view ? null : view));
  };

  const handleSessionChange = (workspaceId: string, sessionId: string) => {
    setActiveSessionIds((prev) => ({ ...prev, [workspaceId]: sessionId }));
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* ── PERSISTENT SIDEBAR ────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-gray-800">
        <Sidebar
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          onWorkspaceDeleted={handleWorkspaceDeleted}
          showToast={showToast}
          sessions={sessions}
          activeSession={activeSession}
          loadingSessions={loadingSessions}
          onNewSession={() => sessionActionsRef.current.newSession()}
          onSelectSession={(s) => sessionActionsRef.current.selectSession(s)}
          onDeleteSession={(id) => sessionActionsRef.current.deleteSession(id)}
          activeView={mainView}
          onSelectView={handleSelectView}
        />
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {mainView === "settings" ? (
          <Settings showToast={showToast} />
        ) : mainView === "kb" ? (
          <KnowledgeBase showToast={showToast} />
        ) : selectedWorkspace ? (
          <WorkspaceDetail
            workspace={selectedWorkspace}
            showToast={showToast}
            activeSessionId={activeSessionIds[selectedWorkspace.id] ?? null}
            onSessionChange={handleSessionChange}
            onSessionsUpdate={handleSessionsUpdate}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/60
                            flex items-center justify-center">
              <span className="text-3xl">💬</span>
            </div>
            <div className="space-y-1">
              <p className="text-gray-200 font-medium text-base">
                Welcome to PC AI Assistant
              </p>
              <p className="text-gray-500 text-sm">
                Select a workspace from the sidebar to get started
              </p>
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
