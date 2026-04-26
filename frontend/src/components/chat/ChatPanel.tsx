import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAvailableModels } from "../../api";
import type { Document, Folder, ChatSessionDetail } from "../../api";
import type { ToastType } from "../../hooks/useToast";
import { useChatStream } from "./useChatStream";
import { useFileAttach } from "./useFileAttach";
import { useMention } from "./useMention";
import { DEFAULT_MODEL } from "./types";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

interface ChatPanelProps {
  showToast: (message: string, type: ToastType) => void;
  activeSession: ChatSessionDetail | null;
  setActiveSession: React.Dispatch<React.SetStateAction<ChatSessionDetail | null>>;
  setSessions: React.Dispatch<React.SetStateAction<import("../../api").ChatSession[]>>;
  workspaceDocs: Document[];
  workspaceFolders: Folder[];
}

export default function ChatPanel({
  showToast,
  activeSession,
  setActiveSession,
  setSessions,
  workspaceDocs,
  workspaceFolders,
}: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([
    DEFAULT_MODEL,
  ]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [useRag, setUseRag] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { loading, streamingText, handleSend, handleStop } =
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
    <div className="flex flex-col h-full overflow-hidden">
      {!activeSession ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-8">
          <p className="text-gray-600 text-sm">
            Select a chat from the sidebar or create a new one
          </p>
        </div>
      ) : (
        <>
          <MessageList
            messages={activeSession.messages}
            streamingText={streamingText}
            loading={loading}
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
    </div>
  );
}
