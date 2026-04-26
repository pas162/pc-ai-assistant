import { useState, useEffect } from "react";
import {
  Bot,
  Search,
  Loader2,
  FileCode,
  Copy,
  Download,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Wand2,
  RotateCcw,
  Info,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { java } from "@codemirror/lang-java";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import {
  fetchJiraTicket,
  fetchMockTicket,
  generateSwtbotScript,
  refineSwtbotScript,
  getJiraStatus,
  type JiraTicketData,
} from "../../api";
import { useToast } from "../../hooks/useToast";

const SAMPLE_TICKETS = [
  { id: "DEMO-1", label: "GPIO Toggle",     component: "GPIO" },
  { id: "DEMO-2", label: "Project Wizard",  component: "Wizard" },
  { id: "DEMO-3", label: "SCI UART Config", component: "UART" },
];

const PRIORITY_COLORS: Record<string, string> = {
  Highest: "text-red-400 bg-red-500/10 border-red-500/20",
  High:    "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Medium:  "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Low:     "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Lowest:  "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

interface SwtbotWorkflowProps {
  workspaceId?: string;
}

export default function SwtbotWorkflow({ workspaceId }: SwtbotWorkflowProps) {
  const { showToast } = useToast();

  const [ticketId, setTicketId] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [ticketData, setTicketData] = useState<JiraTicketData | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [refinementRequest, setRefinementRequest] = useState("");
  const [refineCount, setRefineCount] = useState(0);
  const [jiraConfigured, setJiraConfigured] = useState<boolean | null>(null);
  const [jiraMessage, setJiraMessage] = useState("");

  useEffect(() => {
    getJiraStatus()
      .then((s) => {
        setJiraConfigured(s.configured);
        setJiraMessage(s.message);
      })
      .catch(() => setJiraConfigured(false));
  }, []);

  async function handleFetchTicket() {
    if (!ticketId.trim()) {
      showToast("Please enter a Jira ticket ID", "error");
      return;
    }
    setIsFetching(true);
    try {
      const data = await fetchJiraTicket(ticketId.trim().toUpperCase());
      setTicketData(data);
      setGeneratedCode("");
      setRefineCount(0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to fetch ticket", "error");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleLoadSample(id: string) {
    setIsFetching(true);
    setTicketId(id);
    try {
      const data = await fetchMockTicket(id);
      setTicketData(data);
      setGeneratedCode("");
      setRefineCount(0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load sample", "error");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleGenerate() {
    if (!ticketData) return;
    setIsGenerating(true);
    try {
      const result = await generateSwtbotScript({
        ticket_data: ticketData,
        additional_context: additionalContext || undefined,
        workspace_id: workspaceId,
      });
      setGeneratedCode(result.code);
      setRefineCount(0);
      showToast("Script generated", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to generate script", "error");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefine() {
    if (!ticketData || !generatedCode || !refinementRequest.trim()) return;
    setIsRefining(true);
    try {
      const result = await refineSwtbotScript(generatedCode, refinementRequest, ticketData);
      setGeneratedCode(result.code);
      setRefineCount((c) => c + 1);
      setRefinementRequest("");
      showToast("Script refined", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to refine script", "error");
    } finally {
      setIsRefining(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(generatedCode);
    showToast("Copied to clipboard", "success");
  }

  function handleDownload() {
    const className = ticketData?.key?.replace(/-/g, "_") ?? "Generated";
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${className}Test.java`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded", "success");
  }

  const priorityClass = ticketData
    ? (PRIORITY_COLORS[ticketData.priority] ?? PRIORITY_COLORS.Medium)
    : "";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25
                          flex items-center justify-center">
            <Bot size={16} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-100">SWTBot Script Generator</p>
            <p className="text-xs text-gray-500">Jira → parse → generate → refine</p>
          </div>
        </div>

        {/* Jira connection badge */}
        {jiraConfigured !== null && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border
                          ${jiraConfigured
                            ? "bg-green-500/10 border-green-500/20 text-green-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${jiraConfigured ? "bg-green-500" : "bg-amber-500"}`} />
            {jiraConfigured ? "Jira connected" : "Jira not configured"}
          </div>
        )}
      </div>

      {/* ── Jira warning ────────────────────────────────────────────────── */}
      {jiraConfigured === false && (
        <div className="mx-6 mt-4 p-3 bg-amber-500/8 border border-amber-500/25 rounded-lg
                        flex items-start gap-3 shrink-0">
          <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            {jiraMessage || "Jira is not configured."}{" "}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
              className="underline hover:text-amber-200"
            >
              Open Settings
            </button>
          </p>
        </div>
      )}

      {/* ── Split panel ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT — Ticket panel ──────────────────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col border-r border-gray-800 overflow-hidden">

          {/* Fetch input */}
          <div className="px-4 py-4 border-b border-gray-800 shrink-0">
            <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px]
                               flex items-center justify-center font-bold">1</span>
              Fetch Jira Ticket
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="e.g. ZEPHYR-123"
                className="flex-1 min-w-0 px-3 py-1.5 bg-gray-950 border border-gray-700
                           rounded-lg text-sm text-gray-200 placeholder-gray-600
                           focus:outline-none focus:border-indigo-500 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleFetchTicket()}
              />
              <button
                onClick={handleFetchTicket}
                disabled={isFetching}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500
                           disabled:bg-gray-800 disabled:cursor-not-allowed
                           text-white rounded-lg text-sm flex items-center gap-1.5
                           transition-colors shrink-0"
              >
                {isFetching
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />}
              </button>
            </div>

            {/* Sample tickets */}
            <div>
              <p className="text-xs text-gray-600 mb-1.5">or load a sample:</p>
              <div className="flex flex-col gap-1">
                {SAMPLE_TICKETS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSample(s.id)}
                    disabled={isFetching}
                    className="flex items-center justify-between px-2.5 py-1.5
                               rounded-lg border border-gray-800 bg-gray-800/40
                               hover:bg-gray-800 hover:border-gray-700
                               text-left transition-colors disabled:opacity-40"
                  >
                    <span className="text-xs text-gray-300">{s.label}</span>
                    <span className="text-xs font-mono text-gray-600">{s.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket details */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!ticketData ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6 py-12">
                <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700
                                flex items-center justify-center">
                  <Info size={16} className="text-gray-600" />
                </div>
                <p className="text-sm text-gray-500">Enter a ticket ID above to get started</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Ticket header */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono font-semibold text-indigo-400">
                      {ticketData.key}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${priorityClass}`}>
                      {ticketData.priority}
                    </span>
                    {ticketData.component && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800
                                       border border-gray-700 text-gray-400">
                        {ticketData.component}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-200 leading-snug">
                    {ticketData.name}
                  </p>
                </div>

                {/* Precondition */}
                {ticketData.precondition && (
                  <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                    <p className="text-xs font-medium text-gray-500 mb-1">Precondition</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {ticketData.precondition}
                    </p>
                  </div>
                )}

                {/* Steps */}
                {ticketData.steps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Test Steps ({ticketData.steps.length})
                    </p>
                    <div className="space-y-2">
                      {ticketData.steps.map((step, idx) => (
                        <div key={idx} className="rounded-lg border border-gray-800 overflow-hidden">
                          <div className="flex items-start gap-2 px-3 py-2 bg-gray-800/40">
                            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400
                                             text-xs flex items-center justify-center shrink-0 mt-0.5
                                             font-semibold">
                              {step.step}
                            </span>
                            <p className="text-xs text-gray-300 leading-relaxed">{step.description}</p>
                          </div>
                          {step.expected && (
                            <div className="flex items-start gap-2 px-3 py-2 bg-green-500/5
                                            border-t border-green-500/10">
                              <ChevronRight size={11} className="text-green-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-green-400/80 leading-relaxed">
                                {step.expected}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generate section */}
                <div className="pt-2 border-t border-gray-800">
                  <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px]
                                     flex items-center justify-center font-bold">2</span>
                    Generate Script
                  </p>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Additional context (optional)…"
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg
                               text-xs text-gray-200 placeholder-gray-600
                               focus:outline-none focus:border-indigo-500 resize-none mb-2"
                  />
                  {workspaceId && (
                    <p className="text-xs text-green-500/80 mb-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                      Workspace docs will be used as context
                    </p>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500
                               disabled:bg-gray-800 disabled:cursor-not-allowed
                               text-white rounded-lg text-xs font-medium
                               flex items-center justify-center gap-2 transition-colors"
                  >
                    {isGenerating
                      ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                      : <><Wand2 size={13} /> Generate SWTBot Script</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT — Code panel ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!generatedCode ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-gray-800/60 border border-gray-700/60
                              flex items-center justify-center">
                <FileCode size={24} className="text-gray-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">No script yet</p>
                <p className="text-xs text-gray-600">
                  Fetch a ticket and click Generate to create a SWTBot Java test
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Code toolbar */}
              <div className="flex items-center justify-between px-4 py-2.5
                              border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-xs font-medium text-gray-300">
                    {ticketData?.key}Test.java
                  </span>
                  {refineCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-500/15
                                     text-indigo-400 border border-indigo-500/20">
                      refined ×{refineCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setGeneratedCode(""); setRefineCount(0); }}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                    title="Clear"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800
                               hover:bg-gray-700 text-gray-300 rounded text-xs transition-colors"
                  >
                    <Copy size={12} /> Copy
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800
                               hover:bg-gray-700 text-gray-300 rounded text-xs transition-colors"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>

              {/* Code editor — always editable with syntax highlighting */}
              <div className="flex-1 min-h-0">
                <CodeMirror
                  value={generatedCode}
                  height="100%"
                  theme={vscodeDark}
                  extensions={[java()]}
                  onChange={(val) => setGeneratedCode(val)}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                    highlightActiveLine: true,
                    autocompletion: false,
                  }}
                  style={{ fontSize: "0.8rem", height: "100%" }}
                />
              </div>

              {/* Refine bar */}
              <div className="border-t border-gray-800 px-4 py-3 shrink-0 bg-gray-900/50">
                <div className="flex items-center gap-2">
                  <MessageSquare size={13} className="text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={refinementRequest}
                    onChange={(e) => setRefinementRequest(e.target.value)}
                    placeholder="Refine: e.g. 'add error handling', 'use menu instead of toolbar'…"
                    className="flex-1 min-w-0 px-3 py-1.5 bg-gray-950 border border-gray-700
                               rounded-lg text-xs text-gray-200 placeholder-gray-600
                               focus:outline-none focus:border-indigo-500 transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleRefine()}
                  />
                  <button
                    onClick={handleRefine}
                    disabled={isRefining || !refinementRequest.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500
                               disabled:bg-gray-800 disabled:cursor-not-allowed
                               text-white rounded-lg text-xs font-medium
                               flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    {isRefining
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Wand2 size={13} />}
                    Refine
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
