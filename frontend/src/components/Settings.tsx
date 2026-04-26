import { useState, useEffect } from "react";
import { getSettings, upsertSetting } from "../api";
import type { ToastType } from "../hooks/useToast";
import { Save, Eye, EyeOff } from "lucide-react";

interface SettingsProps {
  showToast: (message: string, type: ToastType) => void;
}

// All settings we support — easy to add more in the future
const SETTING_KEYS = [
  {
    key: "llm_api_token",
    label: "LLM API Token",
    description: "Bearer token used to authenticate with the LLM API",
    secret: true,
    default: "",
  },
  {
    key: "llm_api_base_url",
    label: "LLM API Base URL",
    description: "Base URL of the LLM API server",
    secret: false,
    default: "http://10.210.106.4:8080", // ✅ matches config.py
  },
  {
    key: "jira_base_url",
    label: "Jira Base URL",
    description: "Your Jira instance URL (e.g., https://company.atlassian.net)",
    secret: false,
    default: "",
  },
  {
    key: "jira_api_token",
    label: "Jira API Token",
    description: "Personal Access Token from your Jira account settings",
    secret: true,
    default: "",
  },
];

export default function Settings({ showToast }: SettingsProps) {
  // Stores the current input value for each key
  const [values, setValues] = useState<Record<string, string>>({});
  // Tracks which secret fields are revealed
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  // Tracks which keys are currently being saved
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Load existing settings from the backend on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSettings();
        // Start with defaults, then overwrite with whatever is saved in DB
        const map: Record<string, string> = {};
        SETTING_KEYS.forEach((s) => {
          map[s.key] = s.default; // ✅ seed with default first
        });
        data.forEach((s) => {
          map[s.key] = s.value ?? ""; // ✅ overwrite with DB value if it exists
        });
        setValues(map);
      } catch {
        showToast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (key: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await upsertSetting(key, values[key] ?? "");
      showToast("Setting saved", "success");
    } catch {
      showToast("Failed to save setting", "error");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    key: string,
  ) => {
    if (e.key === "Enter") handleSave(key);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold text-gray-100 mb-6">Settings</h1>

      <div className="flex flex-col gap-6">
        {SETTING_KEYS.map(({ key, label, description, secret }) => (
          <div
            key={key}
            className="bg-gray-800 border border-gray-700 rounded-lg p-5
                       flex flex-col gap-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-200">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={secret && !revealed[key] ? "password" : "text"}
                  value={values[key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  onKeyDown={(e) => handleKeyDown(e, key)}
                  placeholder={`Enter ${label.toLowerCase()}...`}
                  className="w-full bg-gray-900 border border-gray-600 rounded
                             px-3 py-2 text-sm text-gray-200 placeholder-gray-600
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             pr-10"
                />
                {/* Eye toggle — only shown for secret fields */}
                {secret && (
                  <button
                    onClick={() =>
                      setRevealed((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2
                               text-gray-500 hover:text-gray-300 transition-colors"
                    title={revealed[key] ? "Hide" : "Show"}
                  >
                    {revealed[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>

              <button
                onClick={() => handleSave(key)}
                disabled={saving[key]}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
                           disabled:text-gray-500 text-white px-4 py-2 rounded
                           text-sm font-medium transition-colors
                           flex items-center gap-2 shrink-0"
              >
                {saving[key] ? (
                  <span
                    className="w-4 h-4 border-2 border-white
                                   border-t-transparent rounded-full animate-spin"
                  />
                ) : (
                  <>
                    <Save size={14} /> Save
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
