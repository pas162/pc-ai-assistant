import { memo } from "react";
import {
  Send,
  StopCircle,
  Database,
  Paperclip,
  X,
  Folder as FolderIcon,
  FileText,
} from "lucide-react";
import ModelSelector from "./ModelSelector";
import MentionDropdown from "./MentionDropdown";
import { collectDocsUnderFolder, ALLOWED_ATTACH_EXTENSIONS } from "./types";
import type {
  AttachedFile,
  FolderNode,
  MentionItem,
  MentionMode,
} from "./types";
import type { Document } from "../../api";

interface ChatInputProps {
  question: string;
  loading: boolean;
  useRag: boolean;
  availableModels: string[];
  selectedModel: string;
  modelsLoading: boolean;
  attachedFiles: AttachedFile[];
  mentionedDocs: Document[];
  mentionedFolders: FolderNode[];
  mentionOpen: boolean;
  mentionSearch: string;
  mentionIndex: number;
  mentionItems: MentionItem[];
  mentionDropdownRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  workspaceDocsCompletedCount: number;
  mentionMode: MentionMode;
  onSelectMode: (mode: MentionMode) => void;
  onQuestionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  onToggleRag: () => void;
  onModelChange: (model: string) => void;
  onFileAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (filename: string) => void;
  onRemoveMentionedDoc: (id: string) => void;
  onRemoveMentionedFolder: (id: string) => void;
  onMentionSearchChange: (val: string) => void;
  onMentionIndexChange: React.Dispatch<React.SetStateAction<number>>;
  onSelectFile: (doc: Document) => void;
  onSelectFolder: (node: FolderNode) => void;
  onCloseMention: () => void;
}

const ChatInput = memo(function ChatInput({
  question,
  loading,
  useRag,
  availableModels,
  selectedModel,
  modelsLoading,
  attachedFiles,
  mentionedDocs,
  mentionedFolders,
  mentionOpen,
  mentionSearch,
  mentionIndex,
  mentionItems,
  mentionDropdownRef,
  textareaRef,
  fileInputRef,
  workspaceDocsCompletedCount,
  mentionMode,
  onSelectMode,
  onQuestionChange,
  onKeyDown,
  onSend,
  onStop,
  onToggleRag,
  onModelChange,
  onFileAttach,
  onRemoveFile,
  onRemoveMentionedDoc,
  onRemoveMentionedFolder,
  onMentionIndexChange,
  onSelectFile,
  onSelectFolder,
  onCloseMention,
}: ChatInputProps) {
  const hasPills =
    attachedFiles.length > 0 ||
    mentionedFolders.length > 0 ||
    mentionedDocs.length > 0;

  const canSend =
    !!question.trim() || attachedFiles.length > 0 || mentionedDocs.length > 0;

  return (
    <div className="border-t border-gray-700 p-3">
      <div
        className="flex flex-col bg-gray-800 border border-gray-600
                      rounded-xl focus-within:border-blue-500 transition-colors relative"
      >
        {/* Pills */}
        {hasPills && (
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
                  onClick={() => onRemoveFile(f.filename)}
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
                <FolderIcon size={10} className="text-blue-200" />@{node.name}
                <button
                  onClick={() => onRemoveMentionedFolder(node.id)}
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
                    collectDocsUnderFolder(folder).some((d) => d.id === doc.id),
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
                    onClick={() => onRemoveMentionedDoc(doc.id)}
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
          onChange={onQuestionChange}
          onKeyDown={onKeyDown}
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
            mentionMode={mentionMode}
            mentionedDocs={mentionedDocs}
            workspaceDocsCompletedCount={workspaceDocsCompletedCount}
            onIndexChange={onMentionIndexChange}
            onSelectFile={onSelectFile}
            onSelectFolder={onSelectFolder}
            onSelectMode={onSelectMode}
            onClose={onCloseMention}
          />
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 pb-2 pt-0 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ModelSelector
              models={availableModels}
              selected={selectedModel}
              loading={modelsLoading}
              onChange={onModelChange}
            />
            <span className="text-gray-700 text-xs">|</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_ATTACH_EXTENSIONS.join(",")}
              className="hidden"
              onChange={onFileAttach}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
              className={`text-xs transition-colors shrink-0 ${
                attachedFiles.length > 0
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              <Paperclip size={13} />
            </button>
            <span className="text-gray-700 text-xs">|</span>
            <button
              onClick={onToggleRag}
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
          {question.length > 0 && (
            <span className="text-xs text-gray-600 shrink-0">
              {question.length}
            </span>
          )}
          {loading ? (
            <button
              onClick={onStop}
              title="Stop generating"
              className="w-6 h-6 flex items-center justify-center
                         text-red-400 hover:text-red-300 transition-colors shrink-0"
            >
              <StopCircle size={15} />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!canSend}
              title="Send message"
              className="w-6 h-6 flex items-center justify-center text-blue-400
                         hover:text-blue-300 disabled:text-gray-600 transition-colors shrink-0"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatInput;
