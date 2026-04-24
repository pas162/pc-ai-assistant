import { useState, useEffect, useRef, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  getChatSessions,
  createChatSession,
  getChatSession,
  streamMessage,
  deleteChatSession,
  updateChatSession,
  fetchAvailableModels,
} from "../../api";
import type {
  ChatSession,
  ChatSessionDetail,
  ChatMessage,
  ChatSource,
  Document,
  Folder,
} from "../../api";
import type { ToastType } from "../../hooks/useToast";
import {
  MessageSquare,
  Trash2,
  Bot,
  Send,
  ChevronRight,
  Plus,
  Database,
  Paperclip,
  X,
  StopCircle,
  Folder as FolderIcon,
  FileText,
} from "lucide-react";
import MessageBubble from "./MessageBubble";
import ModelSelector from "./ModelSelector";
import MentionDropdown from "./MentionDropdown";
import {
  DEFAULT_MODEL,
  ALLOWED_ATTACH_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  buildMentionTree,
  collectDocsUnderFolder,
} from "./types";
import type { AttachedFile, FolderNode, MentionItem } from "./types";

interface ChatPanelProps {
  workspaceId: string;
  showToast: (message: string, type: ToastType) => void;
  activeSessionId: string | null;
  onSessionChange: (workspaceId: string, sessionId: string) => void;
  workspaceDocs: Document[];
  workspaceFolders: Folder[];
}

export default function ChatPanel({
  workspaceId,
  showToast,
  activeSessionId,
  onSessionChange,
  workspaceDocs,
  workspaceFolders,
}: ChatPanelProps) {
  // ── State ─────────────────────────────────────────────────────────────────
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

  // File attach
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // @ mention
  const [mentionedDocs, setMentionedDocs] = useState<Document[]>([]);
  const [mentionedFolders, setMentionedFolders] = useState<FolderNode[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const sessionsPanelRef = useRef<ImperativePanelHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onSessionChangeRef = useRef(onSessionChange);
  const activeSessionIdRef = useRef(activeSessionId);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);
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
    if (sessionsOpen) sessionsPanelRef.current?.expand();
    else sessionsPanelRef.current?.collapse();
  }, [sessionsOpen]);

  // ── Load sessions ─────────────────────────────────────────────────────────
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
    loadSessions();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // ── Load models ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        const models = await fetchAvailableModels();
        if (!cancelled)
          setAvailableModels(Array.from(new Set([DEFAULT_MODEL, ...models])));
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
    if (activeSession?.id)
      onSessionChangeRef.current(workspaceId, activeSession.id);
  }, [activeSession?.id, workspaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingText]);

  // ── Close mention on outside click ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node) &&
        e.target !== textareaRef.current
      ) {
        setMentionOpen(false);
        setMentionSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── @ mention computed list ───────────────────────────────────────────────
  const { rootFolders: mentionFolders } = buildMentionTree(
    workspaceFolders,
    workspaceDocs,
  );

  const mentionItems: MentionItem[] = [
    ...workspaceDocs
      .filter(
        (d) =>
          d.status === "completed" &&
          !mentionedDocs.some((m) => m.id === d.id) &&
          d.filename.toLowerCase().includes(mentionSearch.toLowerCase()),
      )
      .map((doc): MentionItem => ({ type: "file", doc })),
    ...mentionFolders
      .filter((node) => {
        const available = collectDocsUnderFolder(node).filter(
          (d) => !mentionedDocs.some((m) => m.id === d.id),
        );
        return (
          available.length > 0 &&
          node.name.toLowerCase().includes(mentionSearch.toLowerCase())
        );
      })
      .map((node): MentionItem => ({ type: "folder", node })),
  ];

  // ── @ mention handlers ────────────────────────────────────────────────────
  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionSearch("");
    setMentionIndex(0);
  }, []);

  const commitMention = useCallback(
    (doc?: Document, folder?: FolderNode) => {
      const cursor = textareaRef.current?.selectionStart ?? question.length;
      const textUpToCursor = question.slice(0, cursor);
      const atIndex = textUpToCursor.lastIndexOf("@");
      const newQuestion =
        atIndex !== -1
          ? question.slice(0, atIndex) + question.slice(cursor)
          : question;
      setQuestion(newQuestion);

      if (doc) {
        setMentionedDocs((prev) =>
          prev.some((m) => m.id === doc.id) ? prev : [...prev, doc],
        );
      }
      if (folder) {
        setMentionedFolders((prev) =>
          prev.some((f) => f.id === folder.id) ? prev : [...prev, folder],
        );
        setMentionedDocs((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const toAdd = collectDocsUnderFolder(folder).filter(
            (d) => !existingIds.has(d.id),
          );
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      closeMention();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const pos = atIndex !== -1 ? atIndex : newQuestion.length;
          textareaRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [question, closeMention],
  );

  const selectFile = useCallback(
    (doc: Document) => commitMention(doc, undefined),
    [commitMention],
  );
  const selectFolder = useCallback(
    (node: FolderNode) => commitMention(undefined, node),
    [commitMention],
  );
  const removeMentionedDoc = (id: string) =>
    setMentionedDocs((prev) => prev.filter((d) => d.id !== id));
  const removeMentionedFolder = (id: string) => {
    const node = mentionedFolders.find((f) => f.id === id);
    setMentionedFolders((prev) => prev.filter((f) => f.id !== id));
    if (node) {
      const docIds = new Set(collectDocsUnderFolder(node).map((d) => d.id));
      setMentionedDocs((prev) => prev.filter((d) => !docIds.has(d.id)));
    }
  };

  // ── Textarea change ───────────────────────────────────────────────────────
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuestion(val);

    // Single resize only here — no onInput on the textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    const cursor = e.target.selectionStart;
    const textUpToCursor = val.slice(0, cursor);
    const atIndex = textUpToCursor.lastIndexOf("@");
    if (atIndex !== -1) {
      const charBefore = atIndex > 0 ? textUpToCursor[atIndex - 1] : " ";
      if (charBefore === " " || atIndex === 0) {
        const query = textUpToCursor.slice(atIndex + 1);
        if (!query.includes(" ")) {
          setMentionSearch(query);
          setMentionIndex(0);
          if (!mentionOpen) setMentionOpen(true);
          return;
        }
      }
    }
    if (mentionOpen) closeMention();
  };

  // ── File attach ───────────────────────────────────────────────────────────
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    files.forEach((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_ATTACH_EXTENSIONS.includes(ext)) {
        showToast(`"${file.name}" is not a supported file type.`, "error");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast(`"${file.name}" exceeds the 500KB limit.`, "error");
        return;
      }
      if (attachedFiles.some((f) => f.filename === file.name)) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setAttachedFiles((prev) => [...prev, { filename: file.name, content }]);
      };
      reader.readAsText(file, "utf-8");
    });
  };
  const removeAttachedFile = (filename: string) =>
    setAttachedFiles((prev) => prev.filter((f) => f.filename !== filename));

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % Math.max(mentionItems.length, 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) =>
            (i - 1 + Math.max(mentionItems.length, 1)) %
            Math.max(mentionItems.length, 1),
        );
        return;
      }
      if (e.key === "Enter" && mentionItems.length > 0) {
        e.preventDefault();
        const item = mentionItems[mentionIndex];
        if (item.type === "file") selectFile(item.doc);
        else selectFolder(item.node);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (
      !activeSession ||
      (!question.trim() &&
        attachedFiles.length === 0 &&
        mentionedDocs.length === 0) ||
      loading
    )
      return;

    const questionText = question.trim();
    const filesToSend = [...attachedFiles];
    const mentionedIds = mentionedDocs.map((d) => d.id);

    setQuestion("");
    setAttachedFiles([]);
    setMentionedDocs([]);
    setMentionedFolders([]);
    setLoading(true);
    setStreamingText("");
    setLastSources([]);

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
        (chunk) => {
          setStreamingText((prev) => prev + chunk);
        },
        (data) => {
          setLastSources(data.sources ?? []);
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
        (error) => {
          setActiveSession((prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.filter(
                    (m) => !m.id.startsWith("temp-"),
                  ),
                }
              : prev,
          );
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
        filesToSend,
        mentionedIds,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setStreamingText("");
        setLoading(false);
        return;
      }
      setActiveSession((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter((m) => !m.id.startsWith("temp-")),
            }
          : prev,
      );
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

  // ── Session handlers ──────────────────────────────────────────────────────
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
      if (activeSession?.id === sessionId)
        setActiveSession((prev) => (prev ? { ...prev, title: trimmed } : prev));
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden relative">
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
        {/* ── Sessions panel ── */}
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
              <button
                onClick={handleNewSession}
                className="flex items-center justify-between px-3 py-2 border-b
                           border-gray-700 w-full hover:bg-gray-800 transition-colors
                           group shrink-0"
                title="New Chat"
              >
                <span
                  className="text-xs font-semibold text-gray-400 uppercase
                                 tracking-wide group-hover:text-gray-200 transition-colors"
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

        <PanelResizeHandle
          hitAreaMargins={{ coarse: 10, fine: 5 }}
          className={`w-1 bg-gray-700 hover:bg-blue-500 active:bg-blue-400
                     transition-colors cursor-col-resize
                     ${!sessionsOpen ? "hidden" : ""}`}
        />

        {/* ── Main chat panel ── */}
        <Panel className="flex flex-col overflow-hidden">
          {!activeSession ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              Select a chat or create a new one
            </div>
          ) : (
            <>
              {/* Messages */}
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
              {/* ── Input area ── */}
              <div className="border-t border-gray-700 p-3">
                <div
                  className="flex flex-col bg-gray-800 border border-gray-600
                                rounded-xl focus-within:border-blue-500
                                transition-colors relative"
                >
                  {/* Pills row — only shown when there are pills */}
                  {(attachedFiles.length > 0 ||
                    mentionedFolders.length > 0 ||
                    mentionedDocs.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                      {attachedFiles.map((f) => (
                        <span
                          key={f.filename}
                          className="flex items-center gap-1 bg-gray-700 text-gray-200
                                     text-xs px-2 py-0.5 rounded-full shrink-0"
                        >
                          <Paperclip size={10} className="text-gray-400" />
                          {f.filename}
                          <button
                            onClick={() => removeAttachedFile(f.filename)}
                            className="ml-0.5 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      {mentionedFolders.map((node) => (
                        <span
                          key={node.id}
                          className="flex items-center gap-1 bg-blue-600 text-white
                                     text-xs px-2 py-0.5 rounded-md shrink-0"
                        >
                          <FolderIcon size={10} className="text-blue-200" />@
                          {node.name}
                          <button
                            onClick={() => removeMentionedFolder(node.id)}
                            className="ml-0.5 text-blue-200 hover:text-red-300 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      {mentionedDocs
                        .filter(
                          (doc) =>
                            !mentionedFolders.some((folder) =>
                              collectDocsUnderFolder(folder).some(
                                (d) => d.id === doc.id,
                              ),
                            ),
                        )
                        .map((doc) => (
                          <span
                            key={doc.id}
                            className="flex items-center gap-1 bg-blue-600 text-white
                                       text-xs px-2 py-0.5 rounded-md shrink-0"
                          >
                            <FileText size={10} className="text-blue-200" />@
                            {doc.filename.length > 20
                              ? doc.filename.slice(0, 20) + "…"
                              : doc.filename}
                            <button
                              onClick={() => removeMentionedDoc(doc.id)}
                              className="ml-0.5 text-blue-200 hover:text-red-300 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Textarea — single onChange handler, no onInput */}
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question... (type @ to mention a document)"
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none bg-transparent border-none
                               px-3 pt-2.5 pb-1 text-sm text-gray-200
                               placeholder-gray-500 focus:outline-none
                               disabled:opacity-50 overflow-y-auto
                               min-h-9 max-h-30"
                    style={{ height: "36px" }}
                  />

                  {/* @ mention dropdown */}
                  {mentionOpen && (
                    <MentionDropdown
                      dropdownRef={mentionDropdownRef}
                      mentionItems={mentionItems}
                      mentionIndex={mentionIndex}
                      mentionSearch={mentionSearch}
                      mentionedDocs={mentionedDocs}
                      workspaceDocsCompletedCount={
                        workspaceDocs.filter((d) => d.status === "completed")
                          .length
                      }
                      onSearchChange={(val) => {
                        setMentionSearch(val);
                        setMentionIndex(0);
                      }}
                      onIndexChange={setMentionIndex}
                      onSelectFile={selectFile}
                      onSelectFolder={selectFolder}
                      onClose={closeMention}
                    />
                  )}

                  {/* Bottom toolbar */}
                  <div className="flex items-center justify-between px-2 pb-2 pt-0 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ModelSelector
                        models={availableModels}
                        selected={selectedModel}
                        loading={modelsLoading}
                        onChange={setSelectedModel}
                      />
                      <span className="text-gray-700 text-xs">|</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ALLOWED_ATTACH_EXTENSIONS.join(",")}
                        className="hidden"
                        onChange={handleFileAttach}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach files"
                        className={`text-xs transition-colors shrink-0
                          ${
                            attachedFiles.length > 0
                              ? "text-blue-400 hover:text-blue-300"
                              : "text-gray-600 hover:text-gray-400"
                          }`}
                      >
                        <Paperclip size={13} />
                      </button>
                      <span className="text-gray-700 text-xs">|</span>
                      <button
                        onClick={() => setUseRag(!useRag)}
                        title={
                          useRag
                            ? "RAG enabled — click to disable"
                            : "RAG disabled — click to enable"
                        }
                        className={`text-xs transition-colors shrink-0
                          ${
                            useRag
                              ? "text-blue-400 hover:text-blue-300"
                              : "text-gray-600 hover:text-gray-400"
                          }`}
                      >
                        <Database size={13} />
                      </button>
                    </div>

                    {loading ? (
                      <button
                        onClick={handleStop}
                        title="Stop generating"
                        className="w-6 h-6 flex items-center justify-center
                                   text-red-400 hover:text-red-300 transition-colors shrink-0"
                      >
                        <StopCircle size={15} />
                      </button>
                    ) : (
                      <button
                        onClick={handleSend}
                        disabled={
                          !question.trim() &&
                          attachedFiles.length === 0 &&
                          mentionedDocs.length === 0
                        }
                        title="Send message"
                        className="w-6 h-6 flex items-center justify-center
                                   text-blue-400 hover:text-blue-300
                                   disabled:text-gray-600 transition-colors shrink-0"
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
