import { useState, useRef, useCallback, useEffect } from "react";
import { streamMessage } from "../../api";
import type {
  ChatSessionDetail,
  ChatMessage,
  ChatSource,
  ChatSession,
} from "../../api";
import type { ToastType } from "../../hooks/useToast";
import type { AttachedFile } from "./types";

interface UseChatStreamProps {
  activeSession: ChatSessionDetail | null;
  setActiveSession: React.Dispatch<
    React.SetStateAction<ChatSessionDetail | null>
  >;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  showToast: (message: string, type: ToastType) => void;
}

export function useChatStream({
  activeSession,
  setActiveSession,
  setSessions,
  showToast,
}: UseChatStreamProps) {
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [lastSources, setLastSources] = useState<ChatSource[]>([]);

  const streamingTextRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);

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

      onClear();
      setLoading(true);
      setStreamingText("");
      setLastSources([]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const tempMsg: ChatMessage = {
        id: "temp-" + Date.now(),
        role: "user",
        content: question,
        created_at: new Date().toISOString(),
      };

      setActiveSession((prev) =>
        prev ? { ...prev, messages: [...prev.messages, tempMsg] } : prev,
      );

      try {
        await streamMessage(
          activeSession.id,
          question,
          selectedModel,
          useRag,
          (chunk) => setStreamingText((prev) => prev + chunk),
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
                    content: question,
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

            showToast(
              error.toLowerCase().includes("api token")
                ? "LLM API token not set. Please open Settings and enter your API token."
                : `Streaming failed: ${error}`,
              "error",
            );
          },
          controller.signal,
          attachedFiles,
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
    setLoading(false);
    setStreamingText("");
    showToast("Stopped", "info");
  }, [showToast]);

  return { loading, streamingText, lastSources, handleSend, handleStop };
}
