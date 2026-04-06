function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white p-4">
        <h1 className="text-xl font-bold mb-4">PC-AI-Assistant</h1>
        <p className="text-gray-400 text-sm">Workspaces will appear here</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">
            Welcome to PC-AI-Assistant
          </h2>
          <p className="text-gray-500 mt-2">
            Select a workspace to get started
          </p>
        </div>
      </div>
    </div>
  )
}

export default App