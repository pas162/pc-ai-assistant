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
  const response = await api.get('/documents');
  return response.data;
};

// POST /documents — upload a new file
export const uploadDocument = async (file: File): Promise<Document> => {
  // To send a file, we MUST use FormData, not JSON!
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/documents', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// ─── Workspace-Document Linking API calls ──────────────

// POST /workspaces/{ws_id}/documents/{doc_id}
export const linkDocumentToWorkspace = async (workspaceId: string, documentId: string): Promise<void> => {
  await api.post(`/workspaces/${workspaceId}/documents/${documentId}`);
};

// DELETE /workspaces/{ws_id}/documents/{doc_id}
export const unlinkDocumentFromWorkspace = async (workspaceId: string, documentId: string): Promise<void> => {
  await api.delete(`/workspaces/${workspaceId}/documents/${documentId}`);
};
