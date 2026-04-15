import type { Document } from "../api";
import type { Folder }   from "../api";
import FolderNode        from "./FolderNode";
import DocumentRow       from "./DocumentRow";
import type { FolderNodeData } from "./FolderNode";

interface FolderTreeProps {
  folders:         Folder[];
  documents:       Document[];
  onDeleteDoc:     (doc: Document) => void;
  onDeleteFolder:  (id: string, path: string) => void;
  onCreateFolder:  (parentPath: string) => void;
  onUploadFiles:   (folderPath: string, files: FileList) => void;
  onUploadFolder:  (folderPath: string, files: FileList) => void;
}

// ── Tree Assembly ──────────────────────────────────────────────────────────
// WHY here and not in KnowledgeBase? This is pure data transformation —
// it belongs close to the component that renders it, not in the parent.
function buildTree(folders: Folder[], documents: Document[]): {
  rootFolders:    FolderNodeData[];
  rootDocuments:  Document[];
} {
  // Step 1 — Build a map of path → node
  const nodeMap = new Map<string, FolderNodeData>();
  for (const f of folders) {
    nodeMap.set(f.path, {
      id: f.id, name: f.name, path: f.path,
      children: [], documents: []
    });
  }

  // Step 2 — Link children to parents
  const rootFolders: FolderNodeData[] = [];
  for (const f of folders) {
    const node = nodeMap.get(f.path)!;
    const lastSlash = f.path.lastIndexOf("/");

    if (lastSlash === -1) {
      // No slash = root level folder
      rootFolders.push(node);
    } else {
      // Has slash = has a parent
      const parentPath = f.path.substring(0, lastSlash);
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent missing (shouldn't happen) — treat as root
        rootFolders.push(node);
      }
    }
  }

  // Step 3 — Attach documents to their folder node or root
  const rootDocuments: Document[] = [];
  for (const doc of documents) {
    if (!doc.folder_path) {
      rootDocuments.push(doc);
    } else {
      const node = nodeMap.get(doc.folder_path);
      if (node) {
        node.documents.push(doc);
      } else {
        // Folder was deleted but doc remains — show at root
        rootDocuments.push(doc);
      }
    }
  }

  // Step 4 — Sort everything alphabetically
  rootFolders.sort((a, b) => a.name.localeCompare(b.name));
  rootDocuments.sort((a, b) => a.filename.localeCompare(b.filename));

  return { rootFolders, rootDocuments };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function FolderTree({
  folders, documents,
  onDeleteDoc, onDeleteFolder, onCreateFolder,
  onUploadFiles, onUploadFolder
}: FolderTreeProps) {
  const { rootFolders, rootDocuments } = buildTree(folders, documents);

  if (rootFolders.length === 0 && rootDocuments.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No documents yet. Upload a file or create a folder to get started.
      </div>
    );
  }

  return (
    <div>
      {/* Root-level folders */}
      {rootFolders.map(node => (
        <FolderNode
          key={node.id}
          node={node}
          depth={0}
          onDeleteDoc={onDeleteDoc}
          onDeleteFolder={onDeleteFolder}
          onCreateFolder={onCreateFolder}
          onUploadFiles={onUploadFiles}
          onUploadFolder={onUploadFolder}
        />
      ))}

      {/* Root-level documents (folder_path = null) */}
      {rootDocuments.map(doc => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          depth={0}
          onDelete={onDeleteDoc}
        />
      ))}
    </div>
  );
}