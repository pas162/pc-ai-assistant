import { useState } from "react";
import { MessageSquare, Trash2, Plus } from "lucide-react";
import type { ChatSession, ChatSessionDetail } from "../../api";
import { ConfirmModal } from "../Modal";

interface SessionsSidebarProps {
  // Data
  sessions: ChatSession[];
  activeSession: ChatSessionDetail | null;
  loadingSessions: boolean;
  renamingId: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  // Handlers
  onNewSession: () => void;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onStartRename: (e: React.MouseEvent, session: ChatSession) => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: (sessionId: string) => void;
  onRenameKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    sessionId: string,
  ) => void;
}

export default function SessionsSidebar({
  sessions,
  activeSession,
  loadingSessions,
  renamingId,
  renameValue,
  renameInputRef,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onStartRename,
  onRenameChange,
  onRenameSubmit,
  onRenameKeyDown,
}: SessionsSidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmDeleteSession = sessions.find((s) => s.id === confirmDeleteId);

  return (
    <>
      {/* ── Header row — clicking anywhere creates a new chat ── */}
      <button
        onClick={onNewSession}
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

      {/* ── Session list ── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 py-1 custom-scrollbar">
        {loadingSessions ? (
          <div className="flex flex-col gap-1.5 px-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 rounded bg-gray-800 animate-pulse"
                style={{ opacity: 1 - i * 0.2 }}
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-500 text-center mt-4">No chats yet</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() =>
                renamingId !== session.id && onSelectSession(session)
              }
              className={`group w-full flex items-center justify-between
                px-3 py-2 rounded mx-1 cursor-pointer transition-colors
                ${
                  activeSession?.id === session.id
                    ? "bg-blue-600 text-white font-medium"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
            >
              {/* ── Rename input (shown on double-click) ── */}
              {renamingId === session.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => onRenameChange(e.target.value)}
                  onKeyDown={(e) => onRenameKeyDown(e, session.id)}
                  onBlur={() => onRenameSubmit(session.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-gray-700 text-white text-xs px-1 py-0.5
                             rounded outline-none border border-blue-400 min-w-0"
                />
              ) : (
                /* ── Session title (double-click to rename) ── */
                <span
                  className="truncate flex-1 flex items-center gap-1 text-xs"
                  onDoubleClick={(e) => onStartRename(e, session)}
                  title="Double-click to rename"
                >
                  <MessageSquare size={10} className="shrink-0 text-blue-400" />
                  {session.title}
                </span>
              )}

              {/* ── Delete button (visible on hover) ── */}
              {renamingId !== session.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
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

      {/* ── Delete confirm modal ── */}
      {confirmDeleteSession && (
        <ConfirmModal
          message={`Delete "${confirmDeleteSession.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            onDeleteSession(confirmDeleteSession.id);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </>
  );
}
