import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  getChatSessions,
  createChatSession,
  getChatSession,
  streamMessage,
  deleteChatSession,
  updateChatSession,
} from "../api";
import type { ChatSession, ChatSessionDetail, ChatMessage } from "../api";
import type { ToastType } from "../hooks/useToast";
import {
  MessageSquare,
  Trash2,
  Bot,
  User,
  Send,
  ChevronRight,
  Plus,
} from "lucide-react";
import { fetchAvailableModels } from "../api";

const DEFAULT_MODEL = "databricks-claude-sonnet-4-6";

interface ChatPanelProps {
  workspaceId: string;
  showToast: (message: string, type: ToastType) => void;
  activeSessionId: string | null;
  onSessionChange: (workspaceId: string, sessionId: string) => void;
}

export default function ChatPanel({
  workspaceId,
  showToast,
  activeSessionId,
  onSessionChange,
}: ChatPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSessionDetail | null>(
    null,
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [streamingText, setStreamingText] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([
    DEFAULT_MODEL,
  ]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [modelsLoading, setModelsLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const sessionsPanelRef = useRef<ImperativePanelHandle>(null);

  const onSessionChangeRef = useRef(onSessionChange);
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);
  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (sessionsOpen) {
      sessionsPanelRef.current?.expand();
    } else {
      sessionsPanelRef.current?.collapse();
    }
  }, [sessionsOpen]);

  useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
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
              /* silently ignore */
            }
          }
        }
      } catch {
        /* silently ignore */
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };
    loadSessions();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        const models = await fetchAvailableModels();
        if (!cancelled) {
          setAvailableModels(Array.from(new Set([DEFAULT_MODEL, ...models])));
        }
      } catch {
        if (!cancelled) setAvailableModels([DEFAULT_MODEL]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    };
    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSession?.id) {
      onSessionChangeRef.current(workspaceId, activeSession.id);
    }
  }, [activeSession?.id, workspaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingText]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNewSession = async () => {
    try {
      const newSession = await createChatSession(workspaceId, "New Chat");
      setSessions((prev) => [newSession, ...prev]);
      setActiveSession({ ...newSession, messages: [] });
      showToast("New chat created!", "success");
    } catch {
      showToast("Failed to create chat session", "error");
    }
  };

  const handleSelectSession = async (session: ChatSession) => {
    try {
      const detail = await getChatSession(session.id);
      setActiveSession(detail);
    } catch {
      showToast("Failed to load chat session", "error");
    }
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string,
  ) => {
    e.stopPropagation();
    if (!window.confirm("Delete this chat session?")) return;
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) setActiveSession(null);
      showToast("Chat deleted", "info");
    } catch {
      showToast("Failed to delete session", "error");
    }
  };

  const handleStartRename = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setRenamingId(session.id);
    setRenameValue(session.title);
  };

  const handleRenameSubmit = async (sessionId: string) => {
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
      if (activeSession?.id === sessionId) {
        setActiveSession((prev) => (prev ? { ...prev, title: trimmed } : prev));
      }
    } catch {
      showToast("Failed to rename session", "error");
    } finally {
      setRenamingId(null);
    }
  };

  const handleRenameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    sessionId: string,
  ) => {
    if (e.key === "Enter") handleRenameSubmit(sessionId);
    if (e.key === "Escape") setRenamingId(null);
  };

  const handleSend = async () => {
    if (!activeSession || !question.trim() || loading) return;
    const questionText = question.trim();
    setQuestion("");
    setLoading(true);
    setStreamingText("");

    const tempUserMessage: ChatMessage = {
      id: "temp-" + Date.now(),
      role: "user",
      content: questionText,
      created_at: new Date().toISOString(),
    };
    setActiveSession((prev) =>
      prev ? { ...prev, messages: [...prev.messages, tempUserMessage] } : prev,
    );

    try {
      await streamMessage(
        activeSession.id,
        questionText,
        selectedModel,
        (chunk: string) => {
          setStreamingText((prev) => prev + chunk);
        },
        (data) => {
          setActiveSession((prev) => {
            if (!prev) return prev;
            const withoutTemp = prev.messages.filter(
              (m) => !m.id.startsWith("temp-"),
            );
            return {
              ...prev,
              messages: [
                ...withoutTemp,
                {
                  id: data.user_message_id,
                  role: "user" as const,
                  content: questionText,
                  created_at: new Date().toISOString(),
                },
                {
                  id: data.assistant_message_id,
                  role: "assistant" as const,
                  content: streamingTextRef.current,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          });
          if (data.new_title && activeSession) {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSession.id
                  ? { ...s, title: data.new_title! }
                  : s,
              ),
            );
            setActiveSession((prev) =>
              prev ? { ...prev, title: data.new_title! } : prev,
            );
          }
          setStreamingText("");
          setLoading(false);
        },
        (error: string) => {
          setActiveSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.filter((m) => !m.id.startsWith("temp-")),
            };
          });
          setStreamingText("");
          setLoading(false);
          const isTokenError = error.toLowerCase().includes("api token");
          showToast(
            isTokenError
              ? "LLM API token not set. Please open Settings and enter your API token."
              : `Streaming failed: ${error}`,
            "error",
          );
        },
      );
    } catch {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((m) => !m.id.startsWith("temp-")),
        };
      });
      setStreamingText("");
      setLoading(false);
      showToast("Failed to send message. Please try again.", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // ✅ outer div is the positioning context for the expand button
    <div className="flex h-full overflow-hidden relative">
      {/* Expand button — outside PanelGroup, always visible, anchored to outer div */}
      {!sessionsOpen && (
        <button
          onClick={() => setSessionsOpen(true)}
          className="absolute top-2 left-2 z-20 text-gray-500 hover:text-gray-300
                     p-1 rounded hover:bg-gray-800 transition-colors"
          title="Show chat list"
        >
          <ChevronRight size={14} />
        </button>
      )}

      <PanelGroup
        direction="horizontal"
        autoSaveId="chat-layout"
        className="flex-1"
      >
        {/* ── LEFT: Sessions Panel ────────────────────────────── */}
        <Panel
          ref={sessionsPanelRef}
          defaultSize={22}
          minSize={15}
          maxSize={40}
          collapsible={true}
          collapsedSize={0}
          onCollapse={() => setSessionsOpen(false)}
          onExpand={() => setSessionsOpen(true)}
          style={{ overflow: "hidden", minWidth: 0 }}
          className="flex flex-col gap-2 pt-2 pr-1 pb-2 pl-1"
        >
          {sessionsOpen && (
            <>
              {/* Header — full row is clickable, bottom border acts as separator */}
              <button
                onClick={handleNewSession}
                className="flex items-center justify-between px-3 py-2 border-b border-gray-700
                           w-full hover:bg-gray-800 transition-colors group shrink-0"
                title="New Chat"
              >
                <span
                  className="text-xs font-semibold text-gray-400 uppercase tracking-wide
                                 group-hover:text-gray-200 transition-colors"
                >
                  Chats
                </span>
                <Plus
                  size={15}
                  className="text-gray-400 group-hover:text-white transition-colors"
                />
              </button>

              <div className="flex-1 overflow-y-auto flex flex-col gap-1 py-1 custom-scrollbar">
                {loadingSessions ? (
                  <p className="text-xs text-gray-500 text-center mt-4">
                    Loading...
                  </p>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center mt-4">
                    No chats yet
                  </p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() =>
                        renamingId !== session.id &&
                        handleSelectSession(session)
                      }
                      className={`group w-full flex items-center justify-between
                        px-3 py-2 rounded mx-1 cursor-pointer transition-colors
                        ${
                          activeSession?.id === session.id
                            ? "bg-blue-600 text-white font-medium"
                            : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                        }`}
                    >
                      {renamingId === session.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                          onBlur={() => handleRenameSubmit(session.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-gray-700 text-white text-xs px-1 py-0.5
                                     rounded outline-none border border-blue-400 min-w-0"
                        />
                      ) : (
                        <span
                          className="truncate flex-1 flex items-center gap-1 text-xs"
                          onDoubleClick={(e) => handleStartRename(e, session)}
                          title="Double-click to rename"
                        >
                          <MessageSquare
                            size={10}
                            className="shrink-0 text-blue-400"
                          />
                          {session.title}
                        </span>
                      )}
                      {renamingId !== session.id && (
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400
                                     hover:text-red-400 ml-1 shrink-0 transition-opacity"
                          title="Delete session"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </Panel>

        {/* Drag handle — hidden when collapsed */}
        <PanelResizeHandle
          hitAreaMargins={{ coarse: 10, fine: 5 }}
          className={`w-1 bg-gray-700 hover:bg-blue-500
                     active:bg-blue-400 transition-colors cursor-col-resize
                     ${!sessionsOpen ? "hidden" : ""}`}
        />

        {/* ── RIGHT: Chat Window — no bg, fills remaining space ── */}
        <Panel className="flex flex-col overflow-hidden">
          {!activeSession ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              Select a chat or create a new one
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                {activeSession.messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                    Ask a question about your documents
                  </div>
                ) : (
                  activeSession.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                )}

                {streamingText && (
                  <MessageBubble
                    message={{
                      id: "streaming",
                      role: "assistant",
                      content: streamingText,
                      created_at: new Date().toISOString(),
                    }}
                  />
                )}

                {loading && !streamingText && (
                  <div className="flex gap-2 items-center text-gray-500 text-sm">
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                      <Bot size={14} className="text-green-300" />
                    </div>
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-700 p-3">
                {/* Unified container */}
                <div
                  className="flex flex-col bg-gray-800 border border-gray-600
                                rounded-xl focus-within:border-blue-500
                                transition-colors"
                >
                  {/* Textarea */}
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    disabled={loading}
                    className="flex-1 resize-none bg-transparent border-none
                               px-4 pt-3 pb-1 text-sm text-gray-200
                               placeholder-gray-500 focus:outline-none
                               disabled:opacity-50"
                  />

                  {/* Bottom bar — model selector + send button */}
                  <div className="flex items-center justify-between px-3 pb-2 pt-1">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={modelsLoading}
                      className="bg-gray-700 text-gray-400 text-xs border border-gray-600
                                 rounded-lg px-2 py-1 focus:outline-none focus:ring-1
                                 focus:ring-blue-500 disabled:opacity-50
                                 disabled:cursor-wait max-w-52"
                    >
                      {modelsLoading ? (
                        <option>Loading...</option>
                      ) : (
                        availableModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      onClick={handleSend}
                      disabled={loading || !question.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
                                 disabled:text-gray-500 text-white px-3 py-1.5
                                 rounded-lg text-sm font-medium transition-colors
                                 flex items-center gap-1.5"
                    >
                      {loading ? (
                        <span
                          className="w-4 h-4 border-2 border-white
                                         border-t-transparent rounded-full animate-spin"
                        />
                      ) : (
                        <>
                          Send <Send size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center
                      text-xs shrink-0 mt-1 bg-gray-700"
      >
        {isUser ? (
          <User size={14} className="text-blue-300" />
        ) : (
          <Bot size={14} className="text-green-300" />
        )}
      </div>
      <div
        className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`px-3 py-2 rounded-lg text-sm whitespace-pre-wrap
          ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-none"
              : "bg-gray-800 text-gray-200 rounded-tl-none"
          }`}
        >
          {message.content}
        </div>
        <span className="text-xs text-gray-600">{time}</span>
      </div>
    </div>
  );
}
