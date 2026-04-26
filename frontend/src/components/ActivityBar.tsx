import {
  FolderOpen,
  Database,
  Settings as SettingsIcon,
  MessageSquare,
} from "lucide-react";

export type ActivityView = "workspaces" | "kb" | "settings";

interface ActivityBarProps {
  activeView: ActivityView | null;
  onSelect: (view: ActivityView) => void;
  hasActiveWorkspace: boolean;
}

interface NavItem {
  id: ActivityView;
  icon: React.ReactNode;
  label: string;
  position: "top" | "bottom";
}

export default function ActivityBar({
  activeView,
  onSelect,
  hasActiveWorkspace,
}: ActivityBarProps) {
  const topItems: NavItem[] = [
    {
      id: "workspaces",
      icon: <MessageSquare size={20} />,
      label: "Workspaces",
      position: "top",
    },
    {
      id: "kb",
      icon: <Database size={20} />,
      label: "Knowledge Base",
      position: "top",
    },
  ];

  const bottomItems: NavItem[] = [
    {
      id: "settings",
      icon: <SettingsIcon size={20} />,
      label: "Settings",
      position: "bottom",
    },
  ];

  const renderButton = (item: NavItem) => (
    <button
      key={item.id}
      onClick={() => onSelect(item.id)}
      title={item.label}
      className={`relative w-12 h-12 flex items-center justify-center
                  transition-colors group
                  ${
                    activeView === item.id
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
    >
      {/* Active indicator bar */}
      {activeView === item.id && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-500 rounded-r" />
      )}

      {/* Active workspace dot on Workspaces icon */}
      {item.id === "workspaces" && hasActiveWorkspace && (
        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-green-400 border border-gray-900" />
      )}

      {item.icon}

      {/* Tooltip */}
      <span
        className="absolute left-full ml-2 px-2 py-1 text-xs text-white
                   bg-gray-800 border border-gray-700 rounded whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
      >
        {item.label}
      </span>
    </button>
  );

  return (
    <div
      className="w-12 bg-gray-900 border-r border-gray-700
                 flex flex-col items-center shrink-0"
    >
      {/* App logo */}
      <div className="w-12 h-12 flex items-center justify-center border-b border-gray-700 shrink-0">
        <FolderOpen size={18} className="text-blue-400" />
      </div>

      {/* Top nav items */}
      <div className="flex flex-col items-center flex-1 pt-1">
        {topItems.map(renderButton)}
      </div>

      {/* Bottom nav items */}
      <div className="flex flex-col items-center pb-1 border-t border-gray-700">
        {bottomItems.map(renderButton)}
      </div>
    </div>
  );
}
