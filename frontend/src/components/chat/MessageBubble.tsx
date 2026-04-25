import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, FileText, User } from "lucide-react";
import type { ChatMessage, ChatSource } from "../../api";
import CodeBlock from "./CodeBlock";

interface MessageBubbleProps {
  message: ChatMessage;
  sources?: ChatSource[];
  mentionedDocs?: { id: string; filename: string }[];
}

export default function MessageBubble({
  message,
  sources,
  mentionedDocs,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center
                      text-xs shrink-0 mt-1 bg-gray-700"
      >
        {isUser ? (
          <User size={14} className="text-blue-300" />
        ) : (
          <Bot size={14} className="text-green-300" />
        )}
      </div>

      <div
        className={`flex flex-col gap-1 max-w-[80%]
                       ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`px-3 py-2 rounded-lg text-sm
          ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-none whitespace-pre-wrap"
              : "bg-gray-800 text-gray-200 rounded-tl-none"
          }`}
        >
          {isUser ? (
            <div>
              {message.content}

              {message.role === "user" &&
                mentionedDocs &&
                mentionedDocs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {mentionedDocs.map((doc) => (
                      <span
                        key={doc.id}
                        className="flex items-center gap-1 bg-blue-700 text-blue-100
                     text-xs px-2 py-0.5 rounded-md"
                      >
                        <FileText size={10} />
                        {doc.filename.length > 25
                          ? doc.filename.slice(0, 25) + "…"
                          : doc.filename}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none
                            prose-p:my-1 prose-p:leading-relaxed
                            prose-headings:mt-3 prose-headings:mb-1
                            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
            >
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
                      <code
                        className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5
                                       rounded text-xs font-mono"
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <span className="text-xs text-gray-600">{time}</span>

        {!isUser && sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {sources.map((src) => (
              <span
                key={src.id}
                className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded"
                title={src.filename}
              >
                {src.filename.length > 25
                  ? src.filename.slice(0, 25) + "…"
                  : src.filename}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
