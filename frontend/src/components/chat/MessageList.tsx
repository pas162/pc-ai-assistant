import { memo, useRef, useEffect } from "react";
import { Bot } from "lucide-react";
import MessageBubble from "./MessageBubble";
import type { ChatMessageWithMeta } from "./types";

interface MessageListProps {
  messages: ChatMessageWithMeta[];
  streamingText: string;
  loading: boolean;
}

const MessageList = memo(function MessageList({
  messages,
  streamingText,
  loading,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    isStreamingRef.current = !!streamingText;
  }, [streamingText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!streamingText) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [streamingText]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-24
                          text-gray-600 text-sm text-center">
            Ask a question about your documents
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              sources={msg.sources?.map((s) => s.filename)}
              mentionedDocs={msg.mentionedDocs}
              attachedFiles={msg.attachedFiles}
            />
          ))
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
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700
                            flex items-center justify-center shrink-0">
              <Bot size={13} className="text-green-400" />
            </div>
            <div className="flex items-center gap-1.5 pt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});

export default MessageList;
