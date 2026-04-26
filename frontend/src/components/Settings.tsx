import { useState, useEffect } from "react";
import { getSettings, upsertSetting } from "../api";
import type { ToastType } from "../hooks/useToast";
import { Eye, EyeOff, Bot, Trello, CheckCircle } from "lucide-react";

interface SettingsProps {
  showToast: (message: string, type: ToastType) => void;
}

interface SettingField {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  secret: boolean;
  default: string;
}

interface SettingGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  fields: SettingField[];
}

const GROUPS: SettingGroup[] = [
  {
    id: "llm",
    title: "LLM Provider",
    subtitle: "Configure the language model API used for all chat sessions",
    icon: <Bot size={16} />,
    fields: [
      {
        key: "llm_api_base_url",
        label: "Base URL",
        description: "API server endpoint",
        placeholder: "https://api.groq.com/openai/v1",
        secret: false,
        default: "http://10.210.106.4:8080",
      },
      {
        key: "llm_api_token",
        label: "API Token",
        description: "Bearer token for authentication",
        placeholder: "sk-••••••••••••••••",
        secret: true,
        default: "",
      },
      {
        key: "llm_model",
        label: "Model",
        description: "Model name to use for completions",
        placeholder: "llama-3.3-70b-versatile",
        secret: false,
        default: "llama-3.3-70b-versatile",
      },
    ],
  },
  {
    id: "jira",
    title: "Jira Integration",
    subtitle: "Connect to your Jira instance for issue tracking workflows",
    icon: <Trello size={16} />,
    fields: [
      {
        key: "jira_base_url",
        label: "Base URL",
        description: "Your Jira instance URL",
        placeholder: "https://company.atlassian.net",
        secret: false,
        default: "",
      },
      {
        key: "jira_api_token",
        label: "API Token",
        description: "Personal Access Token from your Jira account",
        placeholder: "••••••••••••••••",
        secret: true,
        default: "",
      },
    ],
  },
];

// All keys flat — used for loading
const ALL_KEYS = GROUPS.flatMap((g) => g.fields);

export default function Settings({ showToast }: SettingsProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSettings();
        const map: Record<string, string> = {};
        ALL_KEYS.forEach((s) => { map[s.key] = s.default; });
        data.forEach((s) => { map[s.key] = s.value ?? ""; });
        setValues(map);
        setSaved(map);
      } catch {
        showToast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveGroup = async (group: SettingGroup) => {
    const groupKey = group.id;
    setSaving((prev) => ({ ...prev, [groupKey]: true }));
    try {
      await Promise.all(
        group.fields.map((f) => upsertSetting(f.key, values[f.key] ?? ""))
      );
      setSaved((prev) => {
        const next = { ...prev };
        group.fields.forEach((f) => { next[f.key] = values[f.key] ?? ""; });
        return next;
      });
      showToast(`${group.title} settings saved`, "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving((prev) => ({ ...prev, [groupKey]: false }));
    }
  };

  const isDirty = (group: SettingGroup) =>
    group.fields.some((f) => values[f.key] !== saved[f.key]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto py-10 px-6 space-y-6">

        {/* Page header */}
        <div className="border-b border-gray-800 pb-5">
          <h1 className="text-lg font-semibold text-gray-100">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure integrations and API credentials.
          </p>
        </div>

        {/* Groups */}
        {GROUPS.map((group) => {
          const dirty = isDirty(group);
          const isSaving = saving[group.id];

          return (
            <div
              key={group.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* Group header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700
                                  flex items-center justify-center text-gray-400 shrink-0">
                    {group.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-100">{group.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{group.subtitle}</p>
                  </div>
                </div>

                {/* Save button — right side of header */}
                <button
                  onClick={() => handleSaveGroup(group)}
                  disabled={isSaving || !dirty}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             text-xs font-medium transition-all shrink-0 ml-4
                             ${dirty
                               ? "bg-blue-600 hover:bg-blue-500 text-white"
                               : "bg-gray-800 text-gray-600 cursor-default"
                             }
                             disabled:opacity-60`}
                >
                  {isSaving ? (
                    <span className="w-3.5 h-3.5 border-2 border-current
                                     border-t-transparent rounded-full animate-spin" />
                  ) : dirty ? (
                    "Save changes"
                  ) : (
                    <><CheckCircle size={12} className="text-green-500" /> Saved</>
                  )}
                </button>
              </div>

              {/* Fields */}
              <div className="divide-y divide-gray-800">
                {group.fields.map((field) => (
                  <div key={field.key} className="px-5 py-4 flex items-center gap-4">
                    {/* Label */}
                    <div className="w-32 shrink-0">
                      <p className="text-xs font-medium text-gray-300">{field.label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{field.description}</p>
                    </div>

                    {/* Input */}
                    <div className="relative flex-1">
                      <input
                        type={field.secret && !revealed[field.key] ? "password" : "text"}
                        value={values[field.key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveGroup(group);
                        }}
                        placeholder={field.placeholder}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg
                                   px-3 py-2 text-sm text-gray-200 placeholder-gray-700
                                   focus:outline-none focus:ring-1 focus:ring-blue-500
                                   focus:border-blue-500 transition-colors
                                   font-mono pr-9"
                      />
                      {field.secret && (
                        <button
                          onClick={() =>
                            setRevealed((prev) => ({
                              ...prev,
                              [field.key]: !prev[field.key],
                            }))
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2
                                     text-gray-600 hover:text-gray-300 transition-colors"
                          title={revealed[field.key] ? "Hide" : "Show"}
                        >
                          {revealed[field.key]
                            ? <EyeOff size={14} />
                            : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
