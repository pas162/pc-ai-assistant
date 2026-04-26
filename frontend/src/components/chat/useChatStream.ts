import { useState, useRef, useCallback, useEffect } from "react";
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

  // Keep streamingTextRef in sync
  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

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
          // ── onChunk ──
          (chunk) => {
            setStreamingText((prev) => prev + chunk);
          },
          // ── onDone ──
          (data: StreamDoneData) => {
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
                    mentionedDocs: docsToShow, // Keep pills after stream finishes
                    attachedFiles: filesToSend, // Keep pills after stream finishes
                  } as unknown as ChatMessageWithMeta, // Bypass DOM Document collision
                  {
                    id: data.assistant_message_id,
                    role: "assistant" as const,
                    content: streamingTextRef.current,
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
