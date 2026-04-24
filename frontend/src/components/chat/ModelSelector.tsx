import { useState, useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { displayModel } from "./types";

interface ModelSelectorProps {
  models: string[];
  selected: string;
  loading: boolean;
  onChange: (model: string) => void;
}

export default function ModelSelector({
  models, selected, loading, onChange,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = models.filter((m) =>
    displayModel(m).toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <span className="text-xs text-gray-600 animate-pulse">
        Loading models...
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className="flex items-center gap-1 text-xs text-gray-400
                   hover:text-gray-200 transition-colors max-w-36 group"
        title={selected}
      >
        <span className="truncate">{displayModel(selected)}</span>
        <svg
          className={`w-3 h-3 shrink-0 transition-transform text-gray-600
                      group-hover:text-gray-400 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round"
                strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 z-50
                        bg-gray-900 border border-gray-700 rounded-lg
                        shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-gray-800 text-xs text-gray-200
                         placeholder-gray-600 px-2 py-1.5 rounded
                         border border-gray-700 focus:outline-none
                         focus:border-blue-500"
            />
          </div>
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">
                No models found
              </p>
            ) : (
              filtered.map((model) => (
                <button
                  key={model}
                  onClick={() => { onChange(model); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors
                    flex items-center justify-between gap-2
                    ${model === selected
                      ? "bg-blue-600/30 text-blue-300"
                      : "text-gray-300 hover:bg-gray-800"}`}
                >
                  <span className="truncate">{displayModel(model)}</span>
                  {model === selected && (
                    <Check size={11} className="text-blue-400 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}