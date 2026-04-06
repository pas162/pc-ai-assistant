import axios from "axios";

// Base URL of our backend
// All requests will start with this
const api = axios.create({
  baseURL: "http://localhost:8000",
});

// ─── Workspace API calls ───────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
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
