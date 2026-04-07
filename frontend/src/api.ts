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

// POST /documents — upload a new file
export const uploadDocument = async (file: File): Promise<Document> => {
  // To send a file, we MUST use FormData, not JSON!
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/documents", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
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
  messages: ChatMessage[];  // full history included
}

export interface SendMessageResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  chunks_used: number;
}

// POST /chat/sessions — create a new session
export const createChatSession = async (
  workspaceId: string,
  title: string = "New Chat"
): Promise<ChatSession> => {
  const response = await api.post("/chat/sessions", {
    workspace_id: workspaceId,
    title,
  });
  return response.data;
};

// GET /chat/sessions?workspace_id=xxx — list sessions for a workspace
export const getChatSessions = async (
  workspaceId: string
): Promise<ChatSession[]> => {
  const response = await api.get("/chat/sessions", {
    params: { workspace_id: workspaceId },
  });
  return response.data;
};

// GET /chat/sessions/:id — get session with full message history
export const getChatSession = async (
  sessionId: string
): Promise<ChatSessionDetail> => {
  const response = await api.get(`/chat/sessions/${sessionId}`);
  return response.data;
};

// POST /chat/sessions/:id/message — send a message
export const sendMessage = async (
  sessionId: string,
  question: string
): Promise<SendMessageResponse> => {
  const response = await api.post(`/chat/sessions/${sessionId}/message`, {
    question,
  });
  return response.data;
};

// POST /chat/sessions/:id/stream — stream a message response
// Uses fetch (not axios) because axios doesn't support SSE streaming
export const streamMessage = (
  sessionId: string,
  question: string,
  onChunk: (text: string) => void,      // called for every text chunk received
  onDone: (data: {                       // called when streaming completes
    user_message_id: string;
    assistant_message_id: string;
    chunks_used: number;
  }) => void,
  onError: (error: string) => void       // called if something goes wrong
): Promise<void> => {
  return fetch(`http://127.0.0.1:8000/chat/sessions/${sessionId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    // response.body is a ReadableStream — we read it chunk by chunk
    const reader = response.body!.getReader();

    // TextDecoder converts raw bytes → string
    const decoder = new TextDecoder();

    // Buffer holds incomplete lines between chunks
    // (a single chunk from fetch may contain partial SSE lines)
    let buffer = "";

    // Recursive function that keeps reading until stream ends
    const read = (): Promise<void> => {
      return reader.read().then(({ done, value }) => {

        // done = true means the stream has ended
        if (done) return;

        // Decode the bytes to string and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split buffer by double newline (SSE event separator)
        const events = buffer.split("\n\n");

        // Last element may be incomplete — keep it in buffer
        // All others are complete events — process them
        buffer = events.pop() ?? "";

        for (const event of events) {
          // Each event looks like: "data: {...json...}"
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6);  // remove "data: "

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.type === "chunk") {
              onChunk(parsed.content);        // forward text to UI
            } else if (parsed.type === "done") {
              onDone({                         // notify UI streaming is complete
                user_message_id: parsed.user_message_id,
                assistant_message_id: parsed.assistant_message_id,
                chunks_used: parsed.chunks_used,
              });
            } else if (parsed.type === "error") {
              onError(parsed.content);         // notify UI of error
            }
          } catch {
            // Malformed JSON — skip
          }
        }

        // Read the next chunk (recursive call)
        return read();
      });
    };

    return read();
  });
};
