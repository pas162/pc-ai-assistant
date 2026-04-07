import { useState, useEffect, useRef } from "react";
import {
  getChatSessions,
  createChatSession,
  getChatSession,
  sendMessage,
} from "../api";
import type { ChatSession, ChatSessionDetail, ChatMessage } from "../api";

interface ChatPanelProps {
  workspaceId: string;
}

export default function ChatPanel({ workspaceId }: ChatPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSessionDetail | null>(
    null,
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false); // sending a message
  const [loadingSessions, setLoadingSessions] = useState(true); // initial load

  // ref to the bottom of the message list — used to auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load sessions when workspace changes ───────────────────────────────────
  useEffect(() => {
    setLoadingSessions(true);
    setActiveSession(null); // clear active session when switching workspaces
    setSessions([]);

    getChatSessions(workspaceId)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, [workspaceId]); // re-runs every time workspaceId changes

  // ── Auto-scroll to bottom when new messages arrive ─────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]); // re-runs when messages array changes

  // ── Create a new session ───────────────────────────────────────────────────
  const handleNewSession = async () => {
    try {
      const newSession = await createChatSession(workspaceId, "New Chat");
      // Add to top of sessions list
      setSessions((prev) => [newSession, ...prev]);
      // Load it as active session (with empty messages array)
      setActiveSession({ ...newSession, messages: [] });
    } catch {
      alert("Failed to create chat session");
    }
  };

  // ── Select an existing session ─────────────────────────────────────────────
  const handleSelectSession = async (session: ChatSession) => {
    try {
      // Fetch full session with message history from backend
      const detail = await getChatSession(session.id);
      setActiveSession(detail);
    } catch {
      alert("Failed to load chat session");
    }
  };

  // ── Send a message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    // Guard: must have a session, a question, and not already loading
    if (!activeSession || !question.trim() || loading) return;

    const questionText = question.trim();
    setQuestion(""); // clear input immediately (feels responsive)
    setLoading(true);

    // Optimistically add user message to UI before API responds
    // This makes the UI feel instant — user sees their message right away
    const tempUserMessage: ChatMessage = {
      id: "temp-" + Date.now(), // temporary ID until real one arrives
      role: "user",
      content: questionText,
      created_at: new Date().toISOString(),
    };
    setActiveSession((prev) =>
      prev ? { ...prev, messages: [...prev.messages, tempUserMessage] } : prev,
    );

    try {
      const response = await sendMessage(activeSession.id, questionText);

      // Replace temp message + add real assistant message
      setActiveSession((prev) => {
        if (!prev) return prev;
        // Remove the temp message, add both real messages from backend
        const withoutTemp = prev.messages.filter(
          (m) => !m.id.startsWith("temp-"),
        );
        return {
          ...prev,
          messages: [
            ...withoutTemp,
            response.user_message,
            response.assistant_message,
          ],
        };
      });
    } catch {
      // Remove temp message if request failed
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((m) => !m.id.startsWith("temp-")),
        };
      });
      alert("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
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
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`w-full text-left px-3 py-2 rounded text-xs truncate transition-colors
                    ${
                      activeSession?.id === session.id
                        ? "bg-blue-100 text-blue-800 font-medium" // active
                        : "text-gray-600 hover:bg-gray-100" // inactive
                    }`}
                >
                  💬 {session.title}
                </button>
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

                {/* Loading indicator while waiting for AI response */}
                {loading && (
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
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                >
                  {loading ? "..." : "Send"}
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

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-1 bg-gray-200">
        {isUser ? "👤" : "🤖"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap
          ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-none" // user: blue, right
              : "bg-gray-100 text-gray-800 rounded-tl-none" // assistant: gray, left
          }`}
      >
        {message.content}
      </div>
    </div>
  );
}
