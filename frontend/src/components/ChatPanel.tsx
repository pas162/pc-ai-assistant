import { useState, useEffect, useRef } from "react";
import {
  getChatSessions,
  createChatSession,
  getChatSession,
  streamMessage,
  deleteChatSession,
} from "../api";
import type { ChatSession, ChatSessionDetail, ChatMessage } from "../api";

interface ChatPanelProps {
  workspaceId: string;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function ChatPanel({ workspaceId, showToast }: ChatPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSessionDetail | null>(
    null,
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false); // sending a message
  const [loadingSessions, setLoadingSessions] = useState(true); // initial load
  const [streamingText, setStreamingText] = useState("");

  // ref to the bottom of the message list — used to auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");

  // Update ref when streamingText changes
  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

  // ── Load sessions when workspace changes ───────────────────────────────────
  useEffect(() => {
    let cancelled = false; // prevents state update if workspace changes again

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

    // Cleanup — if workspaceId changes before fetch completes,
    // cancel the previous fetch's state updates
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // ── Auto-scroll to bottom when new messages arrive ─────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingText]); // re-runs when messages array or streaming text changes
  // ── Create a new session ───────────────────────────────────────────────────
  const handleNewSession = async () => {
    try {
      const newSession = await createChatSession(workspaceId, "New Chat");
      // Add to top of sessions list
      setSessions((prev) => [newSession, ...prev]);
      // Load it as active session (with empty messages array)
      setActiveSession({ ...newSession, messages: [] });
      showToast("New chat created!", "success");
    } catch {
      showToast("Failed to create chat session", "error");
    }
  };

  // ── Select an existing session ─────────────────────────────────────────────
  const handleSelectSession = async (session: ChatSession) => {
    try {
      // Fetch full session with message history from backend
      const detail = await getChatSession(session.id);
      setActiveSession(detail);
    } catch {
      showToast("Failed to load chat session", "error");
    }
  };

  // ── Delete a session ───────────────────────────────────────────────────
  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string,
  ) => {
    e.stopPropagation(); // prevent row click from firing
    if (!window.confirm("Delete this chat session?")) return;
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      // If deleted session was active, clear it
      if (activeSession?.id === sessionId) setActiveSession(null);
      showToast("Chat deleted", "info");
    } catch {
      showToast("Failed to delete session", "error");
    }
  };

  // ── Send a message WITH streaming ─────────────────────────────────────────
  const handleSend = async () => {
    if (!activeSession || !question.trim() || loading) return;

    const questionText = question.trim();
    setQuestion("");
    setLoading(true);
    setStreamingText(""); // clear any previous streaming text

    // Optimistically add user message to UI
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

        // onChunk — called for every text piece received
        // Appends to streamingText which renders as a live bubble
        (chunk) => {
          setStreamingText((prev) => prev + chunk);
        },

        // onDone — called when streaming completes
        // Replaces temp messages with real saved messages from DB
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
                  content: streamingTextRef.current, // use ref for latest value
                  created_at: new Date().toISOString(),
                },
              ],
            };
          });
          setStreamingText(""); // clear streaming bubble
          setLoading(false);
        },

        // onError — called if streaming fails
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

  // ── Send on Enter key (Shift+Enter = new line) ─────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent newline in textarea
      handleSend();
    }
  };
  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">💬 Chat</h3>

      <div className="flex gap-4 h-125">
        {/* ── LEFT: Sessions List ─────────────────────────────────────────── */}
        <div className="w-48 flex flex-col gap-2">
          <button
            onClick={handleNewSession}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded font-medium"
          >
            + New Chat
          </button>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {loadingSessions ? (
              <p className="text-xs text-gray-400 text-center mt-4">
                Loading...
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center mt-4">
                No chats yet
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`group w-full flex items-center justify-between px-3 py-2
                    rounded text-xs cursor-pointer transition-colors
                    ${
                      activeSession?.id === session.id
                        ? "bg-blue-100 text-blue-800 font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                  {/* Title */}
                  <span className="truncate flex-1">💬 {session.title}</span>

                  {/* Delete button — this is what USES handleDeleteSession */}
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400
                               hover:text-red-500 ml-1 shrink-0 transition-opacity"
                    title="Delete session"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Chat Window ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-lg bg-white overflow-hidden">
          {/* No session selected */}
          {!activeSession ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a chat or create a new one
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {activeSession.messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    Ask a question about your documents
                  </div>
                ) : (
                  activeSession.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                )}
                {/* Streaming message bubble */}
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
                {/* Loading indicator while waiting for AI response */}

                {loading && !streamingText && (
                  <div className="flex gap-2 items-center text-gray-400 text-sm">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                      🤖
                    </div>
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                )}
                {/* Invisible div at bottom — scroll target */}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-gray-200 p-3 flex gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  disabled={loading}
                  className="flex-1 resize-none border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !question.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
                             text-white px-4 py-2 rounded text-sm font-medium
                             transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <span
                      className="w-4 h-4 border-2 border-white
                                     border-t-transparent rounded-full animate-spin"
                    />
                  ) : (
                    "Send ➤"
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

// ── Message Bubble sub-component ───────────────────────────────────────────────
// Separated out to keep the main component clean
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  // Format timestamp — e.g. "10:32 AM"
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-1 bg-gray-200">
        {isUser ? "👤" : "🤖"}
      </div>

      {/* Bubble + timestamp stacked */}
      <div
        className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`px-3 py-2 rounded-lg text-sm whitespace-pre-wrap
            ${
              isUser
                ? "bg-blue-600 text-white rounded-tr-none"
                : "bg-gray-100 text-gray-800 rounded-tl-none"
            }`}
        >
          {message.content}
        </div>

        {/* Timestamp below bubble */}
        <span className="text-xs text-gray-400">{time}</span>
      </div>
    </div>
  );
}
