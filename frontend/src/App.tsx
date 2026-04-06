import WorkspaceList from './components/WorkspaceList';
import KnowledgeBase from './components/KnowledgeBase'; // ← 1. Import it

function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* LEFT SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">PC AI Assistant</h1>
        </div>
        
        <WorkspaceList />
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* For now, we just hardcode the Knowledge Base here. 
            Later we will add routing to switch between Workspaces and KB! */}
        <div className="flex-1 overflow-y-auto">
          <KnowledgeBase />
        </div>
      </div>

    </div>
  );
}

export default App;