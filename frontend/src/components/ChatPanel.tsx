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
import type {
  ChatSession,
  ChatSessionDetail,
  ChatMessage,
  ChatSource,
} from "../api";
import type { ToastType } from "../hooks/useToast";
import {
  MessageSquare,
  Trash2,
  Bot,
  User,
  Send,
  ChevronRight,
  Plus,
  Database,
  Copy,
  Check,
  StopCircle,
} from "lucide-react";
import { fetchAvailableModels } from "../api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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
  const [useRag, setUseRag] = useState(true);
  const [lastSources, setLastSources] = useState<ChatSource[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const sessionsPanelRef = useRef<ImperativePanelHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    setLastSources([]); // ← reset sources only
    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        useRag,
        (chunk: string) => {
          setStreamingText((prev) => prev + chunk);
        },
        (data) => {
          setLastSources(data.sources ?? []); // ← keep sources
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
          abortControllerRef.current = null;
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
          abortControllerRef.current = null;
          const isTokenError = error.toLowerCase().includes("api token");
          showToast(
            isTokenError
              ? "LLM API token not set. Please open Settings and enter your API token."
              : `Streaming failed: ${error}`,
            "error",
          );
        },
        controller.signal,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setStreamingText("");
        setLoading(false);
        return;
      }
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

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setStreamingText("");
    showToast("Stopped", "info");
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
                  activeSession.messages.map((msg, index) => {
                    const isLastAssistant =
                      msg.role === "assistant" &&
                      index === activeSession.messages.length - 1;
                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        sources={isLastAssistant ? lastSources : undefined}
                      />
                    );
                  })
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
                <div
                  className="flex flex-col bg-gray-800 border border-gray-600
                              rounded-xl focus-within:border-blue-500
                              transition-colors"
                >
                  {/* Textarea — single row, expands on typing */}
                  <textarea
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      // Auto-resize: reset then grow
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question..."
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none bg-transparent border-none
                               px-3 pt-2.5 pb-2 text-sm text-gray-200
                               placeholder-gray-500 focus:outline-none
                               disabled:opacity-50 overflow-y-auto
                               min-h-9 max-h-30"
                    style={{ height: "36px" }}
                  />

                  {/* Bottom bar */}
                  <div
                    className="flex items-center justify-between
                                  px-2 pb-2 pt-0 gap-2"
                  >
                    {/* Left — model selector + RAG toggle */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={modelsLoading}
                        className="bg-transparent text-gray-500 text-xs
                                   border-none focus:outline-none
                                   disabled:opacity-50 disabled:cursor-wait
                                   max-w-40 truncate cursor-pointer
                                   hover:text-gray-300 transition-colors"
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

                      <span className="text-gray-700 text-xs">|</span>

                      <button
                        onClick={() => setUseRag(!useRag)}
                        title={
                          useRag
                            ? "RAG enabled — click to disable"
                            : "RAG disabled — click to enable"
                        }
                        className={`text-xs transition-colors shrink-0 ${
                          useRag
                            ? "text-blue-400 hover:text-blue-300"
                            : "text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        <Database size={13} />
                      </button>
                    </div>

                    {/* Right — Stop or Send */}
                    {loading ? (
                      <button
                        onClick={handleStop}
                        title="Stop generating"
                        className="w-6 h-6 flex items-center justify-center
                                   text-red-400 hover:text-red-300
                                   transition-colors shrink-0"
                      >
                        <StopCircle size={15} />
                      </button>
                    ) : (
                      <button
                        onClick={handleSend}
                        disabled={!question.trim()}
                        title="Send message"
                        className="w-6 h-6 flex items-center justify-center
                                   text-blue-400 hover:text-blue-300
                                   disabled:text-gray-600
                                   transition-colors shrink-0"
                      >
                        <Send size={14} />
                      </button>
                    )}
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

function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-md overflow-hidden border border-zinc-600">
      {/* Language label + copy icon only */}
      <div
        className="flex items-center justify-between
                      bg-zinc-700 px-3 py-1"
      >
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-zinc-400 hover:text-white transition-colors p-0.5 rounded"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <Check size={13} className="text-green-400" />
          ) : (
            <Copy size={13} />
          )}
        </button>
      </div>

      {/* Code block — no gap, shares border with header */}
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          border: "none", // ← border handled by wrapper div
          fontSize: "0.82rem",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  message,
  sources,
}: {
  message: ChatMessage;
  sources?: ChatSource[];
}) {
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
          className={`px-3 py-2 rounded-lg text-sm
          ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-none whitespace-pre-wrap"
              : "bg-gray-800 text-gray-200 rounded-tl-none"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none
                            prose-p:my-1 prose-p:leading-relaxed
                            prose-headings:mt-3 prose-headings:mb-1
                            prose-ul:my-1 prose-ol:my-1
                            prose-li:my-0.5"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return match ? (
                      <CodeBlock language={match[1]}>
                        {String(children).replace(/\n$/, "")}
                      </CodeBlock>
                    ) : (
                      <code
                        className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5
                                       rounded text-xs font-mono"
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-600">{time}</span>

        {/* Sources — remove the chunks count span, keep only filenames */}
        {!isUser && sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {sources.map((src) => (
              <span
                key={src.id}
                className="text-xs bg-gray-700 text-gray-400
                           px-1.5 py-0.5 rounded"
                title={src.filename}
              >
                {src.filename.length > 25
                  ? src.filename.slice(0, 25) + "…"
                  : src.filename}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
