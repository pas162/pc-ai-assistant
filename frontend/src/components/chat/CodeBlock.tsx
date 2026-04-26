import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const LANG_COLORS: Record<string, string> = {
  python:     "#3b82f6",
  javascript: "#f59e0b",
  typescript: "#3b82f6",
  tsx:        "#06b6d4",
  jsx:        "#f59e0b",
  java:       "#f97316",
  bash:       "#10b981",
  sh:         "#10b981",
  sql:        "#8b5cf6",
  json:       "#6b7280",
  yaml:       "#ec4899",
  xml:        "#f87171",
  css:        "#a78bfa",
  html:       "#fb923c",
  rust:       "#f97316",
  go:         "#06b6d4",
  cpp:        "#3b82f6",
  c:          "#3b82f6",
};

export default function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);
  const dotColor = LANG_COLORS[language.toLowerCase()] ?? "#6b7280";
  const lineCount = children.split("\n").length;

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrap my-4 rounded-xl overflow-hidden border border-gray-700/60
                    bg-[#1a1d27] shadow-lg shadow-black/30">

      {/* ── Header ── */}
      <div className="flex items-center justify-between
                      px-4 py-2 border-b border-gray-700/60 bg-[#1e2130]">
        <div className="flex items-center gap-2">
          {/* Language dot */}
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-xs font-medium text-gray-400 font-mono">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Line count */}
          <span className="text-xs text-gray-600 font-mono">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1
                        rounded-md border transition-all duration-150
                        ${copied
                          ? "border-green-600/50 text-green-400 bg-green-500/10"
                          : "border-gray-600/60 text-gray-400 hover:text-gray-200 hover:border-gray-500 hover:bg-gray-700/50"
                        }`}
            title={copied ? "Copied!" : "Copy code"}
          >
            {copied
              ? <><Check size={11} /> Copied</>
              : <><Copy size={11} /> Copy</>}
          </button>
        </div>
      </div>

      {/* ── Code ── */}
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        showLineNumbers
        lineNumberStyle={{
          color: "#3d4150",
          fontSize: "0.72rem",
          paddingRight: "1.2em",
          userSelect: "none",
          minWidth: "2.5em",
        }}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          border: "none",
          background: "#1a1d27",
          fontSize: "0.8rem",
          lineHeight: "1.65",
          padding: "1rem 1rem 1rem 0.5rem",
          overflowX: "auto",
        }}
        className="code-scrollbar"
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}