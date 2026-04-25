import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { fetchAvailableModels } from "../../api";
import type { Document, Folder } from "../../api";
import type { ToastType } from "../../hooks/useToast";
import {
  Bot,
  Send,
  ChevronRight,
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
import SessionsSidebar from "./SessionsSidebar";
import { useChatSessions } from "./useChatSessions";
import { useChatStream } from "./useChatStream";
import { useFileAttach } from "./useFileAttach";
import { useMention } from "./useMention";
import {
  DEFAULT_MODEL,
  collectDocsUnderFolder,
  ALLOWED_ATTACH_EXTENSIONS,
} from "./types";

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
  const [question, setQuestion] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([
    DEFAULT_MODEL,
  ]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [useRag, setUseRag] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionsPanelRef = useRef<ImperativePanelHandle>(null);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
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
  } = useChatSessions({
    workspaceId,
    activeSessionId,
    onSessionChange,
    showToast,
  });

  const { loading, streamingText, lastSources, handleSend, handleStop } =
    useChatStream({ activeSession, setActiveSession, setSessions, showToast });

  const {
    attachedFiles,
    fileInputRef,
    handleFileAttach,
    removeAttachedFile,
    clearAttachedFiles,
  } = useFileAttach({ showToast });

  const {
    mentionedDocs,
    mentionedFolders,
    mentionOpen,
    mentionSearch,
    mentionIndex,
    mentionDropdownRef,
    mentionItems,
    setMentionSearch,
    setMentionIndex,
    selectFile,
    selectFolder,
    removeMentionedDoc,
    removeMentionedFolder,
    closeMention,
    handleTextareaChange,
    clearMentions,
  } = useMention({
    question,
    setQuestion,
    workspaceDocs,
    workspaceFolders,
    textareaRef,
  });

  // ── Load models ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingText]);

  // ── Panel collapse sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (sessionsOpen) sessionsPanelRef.current?.expand();
    else sessionsPanelRef.current?.collapse();
  }, [sessionsOpen]);

  // ── Send wrapper ──────────────────────────────────────────────────────────
  const onSend = () => {
    handleSend(
      question,
      selectedModel,
      useRag,
      attachedFiles,
      mentionedDocs.map((d) => d.id),
      () => {
        setQuestion("");
        clearAttachedFiles();
        clearMentions();
      },
    );
  };

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
      onSend();
    }
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
        <Panel
          ref={sessionsPanelRef}
          defaultSize={22}
          minSize={15}
          maxSize={40}
          collapsible
          collapsedSize={0}
          onCollapse={() => setSessionsOpen(false)}
          onExpand={() => setSessionsOpen(true)}
          style={{ overflow: "hidden", minWidth: 0 }}
          className="flex flex-col gap-2 pt-2 pr-1 pb-2 pl-1"
        >
          {sessionsOpen && (
            <SessionsSidebar
              sessions={sessions}
              activeSession={activeSession}
              loadingSessions={loadingSessions}
              renamingId={renamingId}
              renameValue={renameValue}
              renameInputRef={renameInputRef}
              onNewSession={handleNewSession}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onStartRename={handleStartRename}
              onRenameChange={(val) => setRenameValue(val)}
              onRenameSubmit={handleRenameSubmit}
              onRenameKeyDown={handleRenameKeyDown}
            />
          )}
        </Panel>

        <PanelResizeHandle
          hitAreaMargins={{ coarse: 10, fine: 5 }}
          className={`w-1 bg-gray-700 hover:bg-blue-500 active:bg-blue-400
                     transition-colors cursor-col-resize ${!sessionsOpen ? "hidden" : ""}`}
        />

        {/* ── Main chat area ── */}
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

              {/* Input area */}
              <div className="border-t border-gray-700 p-3">
                <div
                  className="flex flex-col bg-gray-800 border border-gray-600
                                rounded-xl focus-within:border-blue-500 transition-colors relative"
                >
                  {/* Pills */}
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

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => handleTextareaChange(e, setQuestion)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question... (type @ to mention a document)"
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none bg-transparent border-none
                               px-3 pt-2.5 pb-1 text-sm text-gray-200
                               placeholder-gray-500 focus:outline-none
                               disabled:opacity-50 overflow-y-auto min-h-9 max-h-30"
                    style={{ height: "36px" }}
                  />

                  {/* Mention dropdown */}
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
                        className={`text-xs transition-colors shrink-0 ${attachedFiles.length > 0 ? "text-blue-400 hover:text-blue-300" : "text-gray-600 hover:text-gray-400"}`}
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
                        className={`text-xs transition-colors shrink-0 ${useRag ? "text-blue-400 hover:text-blue-300" : "text-gray-600 hover:text-gray-400"}`}
                      >
                        <Database size={13} />
                      </button>
                    </div>
                    {loading ? (
                      <button
                        onClick={handleStop}
                        title="Stop generating"
                        className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors shrink-0"
                      >
                        <StopCircle size={15} />
                      </button>
                    ) : (
                      <button
                        onClick={onSend}
                        disabled={
                          !question.trim() &&
                          attachedFiles.length === 0 &&
                          mentionedDocs.length === 0
                        }
                        title="Send message"
                        className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-300
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
