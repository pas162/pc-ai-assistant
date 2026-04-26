import { useState, useRef, useCallback } from "react";
import { streamMessage } from "../../api";
import type {
  ChatSessionDetail,
  ChatSession,
  StreamDoneData,
} from "../../api";
import type { ToastType } from "../../hooks/useToast";
import type { AttachedFile, ChatMessageWithMeta } from "./types";

interface UseChatStreamProps {
  activeSession: ChatSessionDetail | null;
  setActiveSession: React.Dispatch<
    React.SetStateAction<ChatSessionDetail | null>
  >;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  showToast: (message: string, type: ToastType) => void;
}

type MentionedDoc = { id: string; filename: string };

export function useChatStream({
  activeSession,
  setActiveSession,
  setSessions,
  showToast,
}: UseChatStreamProps) {
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const streamingTextRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const chunkBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBuffer = useCallback(() => {
    if (chunkBufferRef.current) {
      const accumulated = chunkBufferRef.current;
      streamingTextRef.current = accumulated;
      setStreamingText(accumulated);
    }
    flushTimerRef.current = null;
  }, []);

  const handleSend = useCallback(
    async (
      question: string,
      selectedModel: string,
      useRag: boolean,
      attachedFiles: AttachedFile[],
      mentionedIds: string[],
      mentionedDocs: MentionedDoc[],
      onClear: () => void,
    ) => {
      if (
        !activeSession ||
        (!question.trim() &&
          attachedFiles.length === 0 &&
          mentionedIds.length === 0) ||
        loading
      )
        return;

      // ── Snapshot values before clearing ──────────────────────────────────
      const questionText = question.trim();
      const filesToSend = [...attachedFiles];
      const idsToSend = [...mentionedIds];
      const docsToShow = [...mentionedDocs];

      onClear();

      setLoading(true);
      setStreamingText("");
      chunkBufferRef.current = "";
      streamingTextRef.current = "";
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // ── Optimistic user message ───────────────────────────────────────────
      const tempMsg = {
        id: "temp-" + Date.now(),
        role: "user",
        content: questionText,
        created_at: new Date().toISOString(),
        mentionedDocs: docsToShow,
        attachedFiles: filesToSend,
      } as unknown as ChatMessageWithMeta; // Bypass DOM Document collision
      setActiveSession((prev) =>
        prev ? { ...prev, messages: [...prev.messages, tempMsg] } : prev,
      );

      try {
        await streamMessage(
          activeSession.id,
          questionText,
          selectedModel,
          useRag,
          // ── onChunk — buffer and flush at most every 50ms ──
          (chunk) => {
            chunkBufferRef.current += chunk;
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(flushBuffer, 50);
            }
          },
          // ── onDone ──
          (data: StreamDoneData) => {
            // Cancel any pending throttled flush and get the complete text
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            const finalContent = chunkBufferRef.current;

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
                    mentionedDocs: docsToShow,
                    attachedFiles: filesToSend,
                  } as unknown as ChatMessageWithMeta,
                  {
                    id: data.assistant_message_id,
                    role: "assistant" as const,
                    content: finalContent,
                    created_at: new Date().toISOString(),
                    sources: data.sources ?? [],
                  } as ChatMessageWithMeta,
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
            chunkBufferRef.current = "";
            streamingTextRef.current = "";
            setLoading(false);
            abortControllerRef.current = null;
          },
          // ── onError ──
          (error) => {
            console.log("[handleSend] onError received:", error);

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
            showToast(
              error.toLowerCase().includes("api token")
                ? "LLM API token not set. Please open Settings and enter your API token."
                : `Streaming failed: ${error}`,
              "error",
            );
          },
          controller.signal,
          filesToSend,
          idsToSend,
        );
      } catch (err: unknown) {
        console.log("[handleSend] catch:", err);
        if (err instanceof Error && err.name === "AbortError") {
          setStreamingText("");
          setLoading(false);
          return;
        }
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
        showToast("Failed to send message. Please try again.", "error");
      }
    },
    [activeSession, loading, setActiveSession, setSessions, showToast],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    const partial = streamingTextRef.current;
    setStreamingText("");
    setLoading(false);
    if (partial) {
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
              id: "stopped-" + Date.now(),
              role: "assistant" as const,
              content: partial + " *(stopped)*",
              created_at: new Date().toISOString(),
            } as ChatMessageWithMeta,
          ],
        };
      });
    }
    showToast("Stopped", "info");
  }, [showToast, setActiveSession]);

  return {
    loading,
    streamingText,
    handleSend,
    handleStop,
  };
}
