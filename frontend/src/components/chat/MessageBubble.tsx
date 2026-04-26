import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, FileText, Paperclip, User } from "lucide-react";
import type { ChatMessage } from "../../api";
import CodeBlock from "./CodeBlock";

type MentionedDoc = { id: string; filename: string };
type AttachedFile = { filename: string };

type ChatMessageWithMeta = ChatMessage;

interface MessageBubbleProps {
  message: ChatMessageWithMeta;
  sources?: string[];
  mentionedDocs?: MentionedDoc[];
  attachedFiles?: AttachedFile[];
}

const MessageBubble = memo(function MessageBubble({
  message,
  sources,
  mentionedDocs,
  attachedFiles,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <div className="flex flex-row-reverse items-end gap-2">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <User size={13} className="text-white" />
        </div>

        {/* Bubble */}
        <div className="flex flex-col items-end gap-1 max-w-[75%]">
          <div className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm
                          whitespace-pre-wrap leading-relaxed">
            {message.content}

            {mentionedDocs && mentionedDocs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {mentionedDocs.map((doc) => (
                  <span key={doc.id}
                    className="flex items-center gap-1 bg-blue-700/70 text-blue-100
                               text-xs px-2 py-0.5 rounded-full">
                    <FileText size={9} />
                    {doc.filename.length > 25 ? doc.filename.slice(0, 25) + "…" : doc.filename}
                  </span>
                ))}
              </div>
            )}

            {attachedFiles && attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {attachedFiles.map((f) => (
                  <span key={f.filename}
                    className="flex items-center gap-1 text-xs bg-blue-700/70
                               text-blue-100 px-2 py-0.5 rounded-full">
                    <Paperclip size={9} className="shrink-0" />{f.filename}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-600 pr-1">{time}</span>
        </div>
      </div>
    );
  }

  // ── Assistant message ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-row items-start gap-3">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700
                      flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={13} className="text-green-400" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="prose prose-invert prose-sm max-w-none
                        prose-p:my-1.5 prose-p:leading-relaxed
                        prose-headings:mt-4 prose-headings:mb-1.5 prose-headings:text-gray-100
                        prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
                        prose-strong:text-gray-100 prose-strong:font-semibold
                        prose-code:text-pink-300 prose-code:bg-gray-800 prose-code:px-1.5
                        prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                        prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children }) {
                const match = /language-(\w+)/.exec(className || "");
                return match ? (
                  <CodeBlock language={match[1]}>
                    {String(children).replace(/\n$/, "")}
                  </CodeBlock>
                ) : (
                  <code className="bg-gray-800 text-pink-300 px-1.5 py-0.5
                                   rounded text-xs font-mono">
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Sources */}
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sources.map((filename) => (
              <span key={filename}
                title={filename}
                className="flex items-center gap-1 text-xs text-gray-500
                           bg-gray-800/60 border border-gray-700/60
                           px-2 py-0.5 rounded-full">
                <FileText size={9} className="text-gray-600" />
                {filename.length > 28 ? filename.slice(0, 28) + "…" : filename}
              </span>
            ))}
          </div>
        )}

        <span className="text-xs text-gray-600">{time}</span>
      </div>
    </div>
  );
});

export default MessageBubble;
