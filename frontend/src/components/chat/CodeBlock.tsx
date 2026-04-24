import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-md overflow-hidden border border-zinc-600">
      <div className="flex items-center justify-between bg-zinc-700 px-3 py-1">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-zinc-400 hover:text-white transition-colors p-0.5 rounded"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied
            ? <Check size={13} className="text-green-400" />
            : <Copy size={13} />}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0, border: "none", fontSize: "0.82rem" }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}