import { useState } from "react";
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
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  fetchJiraTicket,
  generateSwtbotScript,
  refineSwtbotScript,
  getJiraStatus,
  type JiraTicketData,
} from "../../api";
import { useToast } from "../../hooks/useToast";

export default function SwtbotWorkflow() {
  const { showToast } = useToast();
  
  // Input states
  const [ticketId, setTicketId] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  
  // Loading states
  const [isFetching, setIsFetching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  
  // Data states
  const [ticketData, setTicketData] = useState<JiraTicketData | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [refinementRequest, setRefinementRequest] = useState("");
  const [jiraConfigured, setJiraConfigured] = useState<boolean | null>(null);
  
  // Check Jira status on mount
  useState(() => {
    checkJiraStatus();
  });
  
  async function checkJiraStatus() {
    try {
      const status = await getJiraStatus();
      setJiraConfigured(status.configured);
      if (!status.configured) {
        showToast(status.message, "info");
      }
    } catch {
      setJiraConfigured(false);
    }
  }
  
  async function handleFetchTicket() {
    if (!ticketId.trim()) {
      showToast("Please enter a Jira ticket ID", "error");
      return;
    }
    
    setIsFetching(true);
    try {
      const data = await fetchJiraTicket(ticketId.trim().toUpperCase());
      setTicketData(data);
      showToast(`Fetched ticket: ${data.key}`, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to fetch ticket",
        "error"
      );
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
      });
      setGeneratedCode(result.code);
      showToast("Script generated successfully", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to generate script",
        "error"
      );
    } finally {
      setIsGenerating(false);
    }
  }
  
  async function handleRefine() {
    if (!ticketData || !generatedCode || !refinementRequest.trim()) return;
    
    setIsRefining(true);
    try {
      const result = await refineSwtbotScript(
        generatedCode,
        refinementRequest,
        ticketData
      );
      setGeneratedCode(result.code);
      setRefinementRequest("");
      showToast("Script refined successfully", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to refine script",
        "error"
      );
    } finally {
      setIsRefining(false);
    }
  }
  
  function handleCopy() {
    navigator.clipboard.writeText(generatedCode);
    showToast("Code copied to clipboard", "success");
  }
  
  function handleDownload() {
    const className = ticketData?.key?.replace(/-/g, "_") || "Test";
    const blob = new Blob([generatedCode], { type: "text/java" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${className}Test.java`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("File downloaded", "success");
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <Bot className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-100">
            SWTBot Script Generator
          </h2>
          <p className="text-sm text-gray-400">
            Generate e² studio test automation from Jira tickets
          </p>
        </div>
      </div>
      
      {/* Jira Config Warning */}
      {jiraConfigured === false && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200">
              Jira is not configured. Please set your JIRA_BASE_URL and JIRA_API_TOKEN in{" "}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
                className="underline hover:text-amber-100"
              >
                Settings
              </button>
              .
            </p>
          </div>
        </div>
      )}
      
      {/* Step 1: Fetch Ticket */}
      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
            1
          </div>
          <h3 className="font-medium text-gray-200">Fetch Jira Ticket</h3>
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="ZEPHYR-12345"
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && handleFetchTicket()}
          />
          <button
            onClick={handleFetchTicket}
            disabled={isFetching}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Fetch
          </button>
        </div>
      </div>
      
      {/* Ticket Preview */}
      {ticketData && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="font-medium text-gray-200">{ticketData.key}</span>
            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
              {ticketData.priority}
            </span>
            {ticketData.component && (
              <span className="px-2 py-0.5 bg-indigo-500/20 rounded text-xs text-indigo-300">
                {ticketData.component}
              </span>
            )}
          </div>
          
          <h4 className="text-sm font-medium text-gray-300 mb-2">{ticketData.name}</h4>
          
          {ticketData.precondition && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Precondition:</p>
              <p className="text-sm text-gray-400">{ticketData.precondition}</p>
            </div>
          )}
          
          {ticketData.steps.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Test Steps:</p>
              <ol className="space-y-2">
                {ticketData.steps.map((step, idx) => (
                  <li key={idx} className="text-sm text-gray-400 pl-4 border-l-2 border-gray-700">
                    <span className="font-medium text-gray-300">{step.step}.</span>{" "}
                    {step.description}
                    {step.expected && (
                      <p className="text-xs text-gray-500 mt-1">
                        Expected: {step.expected}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      
      {/* Step 2: Generate */}
      {ticketData && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
              2
            </div>
            <h3 className="font-medium text-gray-200">Generate Script</h3>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Additional Context (optional)
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="E.g., 'Use specific project name MyTestProject', 'Add extra waits for slow operations'"
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileCode className="w-4 h-4" />
                Generate SWTBot Script
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Generated Code */}
      {generatedCode && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-green-400" />
                <h3 className="font-medium text-gray-200">Generated Script</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
            
            <div className="rounded-lg overflow-hidden border border-gray-700">
              <SyntaxHighlighter
                language="java"
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  fontSize: "0.875rem",
                  background: "#1e1e1e",
                }}
                showLineNumbers
                wrapLongLines
              >
                {generatedCode}
              </SyntaxHighlighter>
            </div>
          </div>
          
          {/* Refinement */}
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <h4 className="font-medium text-gray-300">Refine Script</h4>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={refinementRequest}
                onChange={(e) => setRefinementRequest(e.target.value)}
                placeholder="E.g., 'Add error handling', 'Use menu instead of toolbar'"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                onKeyDown={(e) => e.key === "Enter" && handleRefine()}
              />
              <button
                onClick={handleRefine}
                disabled={isRefining || !refinementRequest.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {isRefining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Refine"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
