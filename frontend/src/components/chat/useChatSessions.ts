import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChatSessions,
  createChatSession,
  getChatSession,
  deleteChatSession,
  updateChatSession,
} from "../../api";
import type { ChatSession, ChatSessionDetail } from "../../api";
import type { ToastType } from "../../hooks/useToast";

interface UseChatSessionsProps {
  workspaceId: string;
  activeSessionId: string | null;
  onSessionChange: (workspaceId: string, sessionId: string) => void;
  showToast: (message: string, type: ToastType) => void;
}

export function useChatSessions({
  workspaceId,
  activeSessionId,
  onSessionChange,
  showToast,
}: UseChatSessionsProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const renameInputRef = useRef<HTMLInputElement>(null);
  const onSessionChangeRef = useRef(onSessionChange);
  const activeSessionIdRef = useRef(activeSessionId);

  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);
  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  // Notify parent when active session changes
  useEffect(() => {
    if (activeSession?.id) onSessionChangeRef.current(workspaceId, activeSession.id);
  }, [activeSession?.id, workspaceId]);

  // Load sessions on workspace change
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingSessions(true);
      setActiveSession(null);
      setSessions([]);
      try {
        const data = await getChatSessions(workspaceId);
        if (!cancelled) {
          setSessions(data);

          if (data.length > 0) {
            const targetId = activeSessionIdRef.current ?? data[0].id;
            const target = data.find((s) => s.id === targetId) ?? data[0];
            try {
              const detail = await getChatSession(target.id);
              if (!cancelled) setActiveSession(detail);
    } catch {
              /* ignore */
    }
          }
        }
    } catch {
        /* ignore */
    } finally {
        if (!cancelled) setLoadingSessions(false);
    }
  };

    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleNewSession = useCallback(async () => {
    try {
      const s = await createChatSession(workspaceId, "New Chat");
      setSessions((prev) => [s, ...prev]);
      setActiveSession({ ...s, messages: [] });
      showToast("New chat created!", "success");
    } catch {
      showToast("Failed to create chat session", "error");
}
  }, [workspaceId, showToast]);

  const handleSelectSession = useCallback(
    async (session: ChatSession) => {
      try {
        const detail = await getChatSession(session.id);
        setActiveSession(detail);
      } catch {
        showToast("Failed to load chat session", "error");
      }
    },
    [showToast],
  );

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (!window.confirm("Delete this chat session?")) return;

      try {
        await deleteChatSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setActiveSession((prev) => (prev?.id === sessionId ? null : prev));
        showToast("Chat deleted", "info");
      } catch {
        showToast("Failed to delete session", "error");
      }
    },
    [showToast],
  );

  const handleStartRename = useCallback((e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setRenamingId(session.id);
    setRenameValue(session.title);
  }, []);

  const handleRenameSubmit = useCallback(
    async (sessionId: string) => {
      const trimmed = renameValue.trim();
      if (!trimmed) {
        setRenamingId(null);
        return;
      }

      try {
        await updateChatSession(sessionId, trimmed);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s)),
        );
        setActiveSession((prev) =>
          prev?.id === sessionId ? { ...prev, title: trimmed } : prev,
        );
      } catch {
        showToast("Failed to rename session", "error");
      } finally {
        setRenamingId(null);
      }
    },
    [renameValue, showToast],
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, sessionId: string) => {
      if (e.key === "Enter") handleRenameSubmit(sessionId);
      if (e.key === "Escape") setRenamingId(null);
    },
    [handleRenameSubmit],
  );

  return {
    sessions,
    setSessions,
    activeSession,
    setActiveSession,
    loadingSessions,
    renamingId,
    renameValue,
    renameInputRef,
    setRenameValue,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleStartRename,
    handleRenameSubmit,
    handleRenameKeyDown,
  };
}
