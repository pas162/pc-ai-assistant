import { memo, useRef, useEffect } from "react";
import { Bot } from "lucide-react";
import MessageBubble from "./MessageBubble";
import type { ChatSource } from "../../api";
import type { ChatMessageWithMeta } from "./types";

interface MessageListProps {
  messages: ChatMessageWithMeta[];
  streamingText: string;
  loading: boolean;
  lastSources: ChatSource[];
}

const MessageList = memo(function MessageList({
  messages,
  streamingText,
  loading,
  lastSources,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          Ask a question about your documents
        </div>
      ) : (
        messages.map((msg, index) => {
          const isLastAssistant =
            msg.role === "assistant" && index === messages.length - 1;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              sources={isLastAssistant ? lastSources : undefined}
              mentionedDocs={msg.mentionedDocs}
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
  );
});

export default MessageList;
