import { useState, useEffect, useRef } from "react";
import {
  getChatSessions,
  createChatSession,
  getChatSession,
  streamMessage,
  deleteChatSession,
} from "../api";
import type { ChatSession, ChatSessionDetail, ChatMessage } from "../api";
import type { ToastType } from "../hooks/useToast";
import {
  MessageSquare,
  Trash2,
  Bot,
  User,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ChatPanelProps {
  workspaceId: string;
  showToast: (message: string, type: ToastType) => void;
}

export default function ChatPanel({ workspaceId, showToast }: ChatPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSessionDetail | null>(
    null,
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [streamingText, setStreamingText] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(true); // ← add this

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");

  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

  useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
      setLoadingSessions(true);
      setActiveSession(null);
      setSessions([]);
      try {
        const data = await getChatSessions(workspaceId);
        if (!cancelled) setSessions(data);
      } catch {
        // silently ignore
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingText]);

  // ── Handlers ────────────────────────────────────────────────────────────────
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
        (chunk) => {
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
          setStreamingText("");
          setLoading(false);
        },
        (error) => {
          setActiveSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.filter((m) => !m.id.startsWith("temp-")),
            };
          });
          setStreamingText("");
          setLoading(false);
          showToast(`Streaming failed: ${error}`, "error");
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-4 h-full">
        {/* ── LEFT: Sessions List — collapsible ───────────────── */}
        <div
          className={`flex flex-col gap-2 transition-all duration-300 overflow-hidden
          ${sessionsOpen ? "w-48" : "w-8"}`}
        >
          {sessionsOpen ? (
            // ── EXPANDED ──────────────────────────────────────
            <>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNewSession}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white
                             text-sm px-3 py-2 rounded font-medium transition-colors"
                >
                  + New Chat
                </button>
                {/* Collapse button */}
                <button
                  onClick={() => setSessionsOpen(false)}
                  className="text-gray-500 hover:text-gray-300 p-2 rounded
                             hover:bg-gray-800 transition-colors"
                  title="Hide chat list"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-1">
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
                      onClick={() => handleSelectSession(session)}
                      className={`group w-full flex items-center justify-between
                        px-3 py-2 rounded text-xs cursor-pointer transition-colors
            ${
              activeSession?.id === session.id
                ? "bg-blue-600 text-white font-medium"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
                    >
                      <span className="truncate flex-1 flex items-center gap-1">
                        <MessageSquare
                          size={12}
                          className="shrink-0 text-blue-400"
                        />
                        {session.title}
                      </span>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400
                                   hover:text-red-400 ml-1 shrink-0 transition-opacity"
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            // ── COLLAPSED — show only expand button ───────────
            <button
              onClick={() => setSessionsOpen(true)}
              className="text-gray-500 hover:text-gray-300 p-2 rounded
                         hover:bg-gray-800 transition-colors"
              title="Show chat list"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* ── RIGHT: Chat Window ──────────────────────────────────────────── */}
        <div
          className="flex-1 flex flex-col border border-gray-700 rounded-lg
                        bg-gray-900 overflow-hidden"
        >
          {!activeSession ? (
            <div
              className="flex-1 flex items-center justify-center
                            text-gray-600 text-sm"
            >
              Select a chat or create a new one
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {activeSession.messages.length === 0 ? (
                  <div
                    className="flex-1 flex items-center justify-center
                                  text-gray-600 text-sm"
                  >
                    Ask a question about your documents
                  </div>
                ) : (
                  activeSession.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                )}

                {/* Streaming bubble */}
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

                {/* Thinking indicator */}
                {loading && !streamingText && (
                  <div className="flex gap-2 items-center text-gray-500 text-sm">
                    <div
                      className="w-6 h-6 rounded-full bg-gray-700
                                    flex items-center justify-center text-xs"
                    >
                      <Bot size={14} className="text-green-300" />
                    </div>
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-gray-700 p-3 flex gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  disabled={loading}
                  className="flex-1 resize-none bg-gray-800 border border-gray-600
                             rounded px-3 py-2 text-sm text-gray-200
                             placeholder-gray-500 focus:outline-none
                             focus:ring-2 focus:ring-blue-500
                             disabled:opacity-50 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !question.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
                             disabled:text-gray-500 text-white px-4 py-2 rounded
                             text-sm font-medium transition-colors
                             flex items-center gap-2"
                >
                  {loading ? (
                    <span
                      className="w-4 h-4 border-2 border-white
                                     border-t-transparent rounded-full animate-spin"
                    />
                  ) : (
                    <>
                      Send <Send size={14} />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
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

      {/* Bubble + timestamp */}
      <div
        className={`flex flex-col gap-1 max-w-[80%]
        ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`px-3 py-2 rounded-lg text-sm whitespace-pre-wrap
            ${
              isUser
                ? "bg-blue-600 text-white rounded-tr-none"
                : "bg-gray-800 text-gray-200 rounded-tl-none" // ← dark assistant bubble
            }`}
        >
          {message.content}
        </div>
        <span className="text-xs text-gray-600">{time}</span>
      </div>
    </div>
  );
}
