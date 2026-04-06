import WorkspaceList from './components/WorkspaceList';

function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* LEFT SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">PC AI Assistant</h1>
        </div>

        {/* WorkspaceList now lives here */}
        <WorkspaceList />
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
          <p>Select a workspace from the sidebar to get started.</p>
        </div>
      </div>

    </div>
  );
}

export default App;
