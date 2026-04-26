import { useState, useEffect, useRef, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { fetchAvailableModels } from "../../api";
import type { Document, Folder } from "../../api";
import type { ToastType } from "../../hooks/useToast";
import { ChevronRight } from "lucide-react";
import SessionsSidebar from "./SessionsSidebar";
import { useChatSessions } from "./useChatSessions";
import { useChatStream } from "./useChatStream";
import { useFileAttach } from "./useFileAttach";
import { useMention } from "./useMention";
import { DEFAULT_MODEL } from "./types";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

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
    selectedModel,
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
    mentionMode,
    selectMode,
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
        
        if (!cancelled) {
          if (models.length === 0) {
            // No models available from API
            setAvailableModels([]);
            showToast("No available models from LLM API", "error");
          } else if (models.includes(DEFAULT_MODEL)) {
            // Default model exists in list, use it
            setAvailableModels(models);
            setSelectedModel(DEFAULT_MODEL);
          } else {
            // Default not in list, use first available
            setAvailableModels(models);
            setSelectedModel(models[0]);
            showToast(`Using ${models[0]} (default not available)`, "info");
          }
        }
      } catch {
        if (!cancelled) {
          setAvailableModels([]);
          showToast("Failed to fetch models from LLM API", "error");
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // ── Panel collapse sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (sessionsOpen) sessionsPanelRef.current?.expand();
    else sessionsPanelRef.current?.collapse();
  }, [sessionsOpen]);

  // ── Sync selected model with session's model ───────────────────────────────
  useEffect(() => {
    if (activeSession?.model && availableModels.includes(activeSession.model)) {
      setSelectedModel(activeSession.model);
    }
  }, [activeSession?.id, activeSession?.model, availableModels]);

  // ── Memoize onSend to avoid re-renders ────────────────────────────────────
  const onSend = useCallback(() => {
    handleSend(
      question,
      selectedModel,
      useRag,
      attachedFiles,
      mentionedDocs.map((d) => d.id),
      mentionedDocs.map((d) => ({ id: d.id, filename: d.filename })),
      () => {
        setQuestion("");
        clearAttachedFiles();
        clearMentions();
      },
    );
  }, [
    question,
    selectedModel,
    useRag,
    attachedFiles,
    mentionedDocs,
    handleSend,
    clearAttachedFiles,
    clearMentions,
  ]);

  const onToggleRag = useCallback(() => setUseRag((r) => !r), []);
  const onModelChange = useCallback((m: string) => setSelectedModel(m), []);

  // ── Textarea change — keep stable, only question state changes ────────────
  const onQuestionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      handleTextareaChange(e, setQuestion),
    [handleTextareaChange],
  );

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      // ── Mode picker is showing (no mode selected, no search) ──
      if (mentionMode === "all" && mentionSearch === "") {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          // Toggle between 0 (Files) and 1 (Folders)
          setMentionIndex((i) => (i === 0 ? 1 : 0));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          selectMode(mentionIndex === 0 ? "files" : "folders");
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMention();
          return;
        }
        return;
      }

      // ── Normal item navigation (mode selected or typing) ──
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
              <MessageList
                messages={activeSession.messages}
                streamingText={streamingText}
                loading={loading}
                lastSources={lastSources}
              />
              <ChatInput
                question={question}
                loading={loading}
                useRag={useRag}
                availableModels={availableModels}
                selectedModel={selectedModel}
                modelsLoading={modelsLoading}
                attachedFiles={attachedFiles}
                mentionedDocs={mentionedDocs}
                mentionedFolders={mentionedFolders}
                mentionOpen={mentionOpen}
                mentionSearch={mentionSearch}
                mentionIndex={mentionIndex}
                mentionItems={mentionItems}
                mentionMode={mentionMode}
                onSelectMode={selectMode}
                mentionDropdownRef={mentionDropdownRef}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                workspaceDocsCompletedCount={
                  workspaceDocs.filter((d) => d.status === "completed").length
                }
                onQuestionChange={onQuestionChange}
                onKeyDown={handleKeyDown}
                onSend={onSend}
                onStop={handleStop}
                onToggleRag={onToggleRag}
                onModelChange={onModelChange}
                onFileAttach={handleFileAttach}
                onRemoveFile={removeAttachedFile}
                onRemoveMentionedDoc={removeMentionedDoc}
                onRemoveMentionedFolder={removeMentionedFolder}
                onMentionSearchChange={setMentionSearch}
                onMentionIndexChange={setMentionIndex}
                onSelectFile={selectFile}
                onSelectFolder={selectFolder}
                onCloseMention={closeMention}
              />
            </>
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
}
