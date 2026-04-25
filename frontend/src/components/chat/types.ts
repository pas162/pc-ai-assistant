import type { Document } from "../../api";

export interface AttachedFile {
  filename: string;
  content: string;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  documents: Document[];
  children: FolderNode[];
}

export const ALLOWED_ATTACH_EXTENSIONS = [
  ".py",
  ".java",
  ".xml",
  ".txt",
  ".json",
  ".ts",
  ".js",
  ".md",
  ".yaml",
  ".yml",
  ".sql",
  ".sh",
];

export const MAX_FILE_SIZE_BYTES = 500 * 1024;

export const DEFAULT_MODEL = "databricks-claude-sonnet-4-6";

export const displayModel = (model: string) =>
  model.replace(/^databricks-/, "");
export function buildMentionTree(
  folders: import("../../api").Folder[],
  documents: Document[],
): { rootFolders: FolderNode[]; rootDocuments: Document[] } {
  const nodeMap = new Map<string, FolderNode>();
  for (const f of folders) {
    nodeMap.set(f.path, {
      id: f.id,
      name: f.name,
      path: f.path,
      documents: [],
      children: [],
    });
  }

  const rootFolders: FolderNode[] = [];
  for (const f of folders) {
    const node = nodeMap.get(f.path)!;
    const slash = f.path.lastIndexOf("/");
    if (slash === -1) rootFolders.push(node);
    else {
      const parent = nodeMap.get(f.path.substring(0, slash));
      if (parent) parent.children.push(node);
      else rootFolders.push(node);
    }
  }

  const rootDocuments: Document[] = [];
  for (const doc of documents) {
    if (doc.status !== "completed") continue;
    if (!doc.folder_path) rootDocuments.push(doc);
    else {
      const node = nodeMap.get(doc.folder_path);
      if (node) node.documents.push(doc);
      else rootDocuments.push(doc);
    }
  }

  rootFolders.sort((a, b) => a.name.localeCompare(b.name));
  rootDocuments.sort((a, b) => a.filename.localeCompare(b.filename));
  return { rootFolders, rootDocuments };
}

export function collectDocsUnderFolder(node: FolderNode): Document[] {
  return [...node.documents, ...node.children.flatMap(collectDocsUnderFolder)];
}

export type MentionItem =
  | { type: "file"; doc: import("../../api").Document }
  | { type: "folder"; node: FolderNode };

export type MentionMode = "all" | "files" | "folders";
