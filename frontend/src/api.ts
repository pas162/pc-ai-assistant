import axios from "axios";

// Base URL of our backend
// All requests will start with this
const api = axios.create({
  baseURL: "http://localhost:8000",
});

// ─── Workspace API calls ───────────────────────────────

export interface Document {
  id: string;
  filename: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  progress: number;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  documents: Document[];
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string | null;
}

// GET /workspaces — fetch all workspaces
export const getWorkspaces = async (): Promise<Workspace[]> => {
  const response = await api.get("/workspaces");
  return response.data;
};

// POST /workspaces — create a new workspace
export const createWorkspace = async (
  data: CreateWorkspaceRequest,
): Promise<Workspace> => {
  const response = await api.post("/workspaces", data);
  return response.data;
};

export const updateWorkspace = async (
  id: string,
  data: UpdateWorkspaceRequest,
): Promise<Workspace> => {
  const response = await api.put(`/workspaces/${id}`, data);
  return response.data;
};

// DELETE /workspaces/:id — delete a workspace
export const deleteWorkspace = async (id: string): Promise<void> => {
  await api.delete(`/workspaces/${id}`);
};

// GET /documents — fetch all documents in the Knowledge Base
export const getDocuments = async (): Promise<Document[]> => {
  const response = await api.get("/documents");
  return response.data;
};

// POST /documents — upload a new file with progress reporting
export const uploadDocument = async (
  file: File,
  onProgress?: (percent: number) => void, // ← new optional param
): Promise<Document> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/documents", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        onProgress(percent);
      }
    },
  });
  return response.data;
};

// DELETE /documents/:id — delete a document from the Knowledge Base
export const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/documents/${id}`);
};

// ─── Workspace-Document Linking API calls ──────────────
// POST /workspaces/{ws_id}/documents/{doc_id}
export const linkDocumentToWorkspace = async (
  workspaceId: string,
  documentId: string,
): Promise<void> => {
  await api.post(`/workspaces/${workspaceId}/documents/${documentId}`);
};

// DELETE /workspaces/{ws_id}/documents/{doc_id}
export const unlinkDocumentFromWorkspace = async (
  workspaceId: string,
  documentId: string,
): Promise<void> => {
  await api.delete(`/workspaces/${workspaceId}/documents/${documentId}`);
};

// ─── Chat API calls ────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[]; // full history included
}

export interface SendMessageResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  chunks_used: number;
}

// POST /chat/sessions — create a new session
export const createChatSession = async (
  workspaceId: string,
  title: string = "New Chat",
): Promise<ChatSession> => {
  const response = await api.post("/chat/sessions", {
    workspace_id: workspaceId,
    title,
  });
  return response.data;
};

// GET /chat/sessions?workspace_id=xxx — list sessions for a workspace
export const getChatSessions = async (
  workspaceId: string,
): Promise<ChatSession[]> => {
  const response = await api.get("/chat/sessions", {
    params: { workspace_id: workspaceId },
  });
  return response.data;
};

// GET /chat/sessions/:id — get session with full message history
export const getChatSession = async (
  sessionId: string,
): Promise<ChatSessionDetail> => {
  const response = await api.get(`/chat/sessions/${sessionId}`);
  return response.data;
};

// DELETE /chat/sessions/:id — delete a session and all its messages
export const deleteChatSession = async (sessionId: string): Promise<void> => {
  await api.delete(`/chat/sessions/${sessionId}`);
};

// PATCH /chat/sessions/:id — rename a session
export const updateChatSession = async (
  sessionId: string,
  title: string,
): Promise<ChatSession> => {
  const response = await api.patch(`/chat/sessions/${sessionId}`, { title });
  return response.data;
};

// POST /chat/sessions/:id/stream — stream a message response
// Uses fetch (not axios) because axios doesn't support SSE streaming
export const streamMessage = (
  sessionId: string,
  question: string,
  model: string,
  useRag: boolean,
  onChunk: (text: string) => void,
  onDone: (data: {
    user_message_id: string;
    assistant_message_id: string;
    chunks_used: number;
    new_title: string | null; // ← add this
  }) => void,
  onError: (error: string) => void,
): Promise<void> => {
  return fetch(`http://127.0.0.1:8000/chat/sessions/${sessionId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, model, use_rag: useRag }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const read = (): Promise<void> => {
      return reader.read().then(({ done, value }) => {
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "chunk") {
              onChunk(parsed.content);
            } else if (parsed.type === "done") {
              onDone({
                user_message_id: parsed.user_message_id,
                assistant_message_id: parsed.assistant_message_id,
                chunks_used: parsed.chunks_used,
                new_title: parsed.new_title,
              });
            } else if (parsed.type === "error") {
              onError(parsed.content);
            }
          } catch {
            // Malformed JSON — skip
          }
        }
        return read();
      });
    };

    return read();
  });
};

// POST /chat/sessions/:id/message — send a message
export const sendMessage = async (
  sessionId: string,
  question: string,
  model: string,
  useRag: boolean = true,
): Promise<SendMessageResponse> => {
  const response = await api.post(`/chat/sessions/${sessionId}/message`, {
    question,
    model,
    use_rag: useRag,
  });
  return response.data;
};

export const fetchAvailableModels = async (): Promise<string[]> => {
  const response = await axios.get(`${api.defaults.baseURL}/models`);
  return response.data.models;
};

// ─── Settings API calls ────────────────────────────────

export interface Setting {
  key: string;
  value: string | null;
  updated_at: string;
}

// GET /settings — fetch all settings
export const getSettings = async (): Promise<Setting[]> => {
  const response = await api.get("/settings");
  return response.data;
};

// PUT /settings/:key — insert or update a setting
export const upsertSetting = async (
  key: string,
  value: string,
): Promise<Setting> => {
  const response = await api.put(`/settings/${key}`, { value });
  return response.data;
};
