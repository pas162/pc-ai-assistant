import { useState } from "react";
import WorkspaceList from "./components/WorkspaceList";
import KnowledgeBase from "./components/KnowledgeBase";
import WorkspaceDetail from "./components/WorkspaceDetail";
import type { Workspace } from "./api";

function App() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* LEFT SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">PC AI Assistant</h1>
        </div>

        {/* Pass the setter function down to the sidebar */}
        <WorkspaceList
          selectedWorkspaceId={selectedWorkspace?.id ?? null}
          onSelectWorkspace={setSelectedWorkspace}
        />

        {/* Knowledge Base button at the bottom of sidebar */}
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={() => setSelectedWorkspace(null)}
            className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors
              ${
                selectedWorkspace === null
                  ? "bg-blue-600 text-white" // active state
                  : "text-gray-400 hover:text-white hover:bg-gray-700" // inactive state
              }`}
          >
            📚 Knowledge Base
          </button>
        </div>
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {selectedWorkspace === null ? (
            // No workspace selected → show Knowledge Base
            <KnowledgeBase />
          ) : (
            // Workspace selected → show Workspace Detail
            <WorkspaceDetail workspace={selectedWorkspace} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
