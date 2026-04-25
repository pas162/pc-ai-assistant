import { useState, useRef, useCallback, useEffect } from "react";
import { buildMentionTree, collectDocsUnderFolder } from "./types";
import type { FolderNode, MentionItem } from "./types";
import type { Document, Folder } from "../../api";

interface UseMentionProps {
  question: string;
  setQuestion: (q: string) => void;
  workspaceDocs: Document[];
  workspaceFolders: Folder[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useMention({
  question,
  setQuestion,
  workspaceDocs,
  workspaceFolders,
  textareaRef,
}: UseMentionProps) {
  const [mentionedDocs, setMentionedDocs] = useState<Document[]>([]);
  const [mentionedFolders, setMentionedFolders] = useState<FolderNode[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node) &&
        e.target !== textareaRef.current
      ) {
        setMentionOpen(false);
        setMentionSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [textareaRef]);

  // Build mention items list
  const { rootFolders: mentionFolders } = buildMentionTree(
    workspaceFolders,
    workspaceDocs,
  );

  const mentionItems: MentionItem[] = [
    ...workspaceDocs
      .filter(
        (d) =>
          d.status === "completed" &&
          !mentionedDocs.some((m) => m.id === d.id) &&
          d.filename.toLowerCase().includes(mentionSearch.toLowerCase()),
      )
      .map((doc): MentionItem => ({ type: "file", doc })),
    ...mentionFolders
      .filter((node) => {
        const available = collectDocsUnderFolder(node).filter(
          (d) => !mentionedDocs.some((m) => m.id === d.id),
        );
        return (
          available.length > 0 &&
          node.name.toLowerCase().includes(mentionSearch.toLowerCase())
        );
      })
      .map((node): MentionItem => ({ type: "folder", node })),
  ];

  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionSearch("");
    setMentionIndex(0);
  }, []);

  const commitMention = useCallback(
    (doc?: Document, folder?: FolderNode) => {
      const cursor = textareaRef.current?.selectionStart ?? question.length;
      const textUpToCursor = question.slice(0, cursor);
      const atIndex = textUpToCursor.lastIndexOf("@");

      const newQuestion =
        atIndex !== -1
          ? question.slice(0, atIndex) + question.slice(cursor)
          : question;

      setQuestion(newQuestion);

      if (doc) {
        setMentionedDocs((prev) =>
          prev.some((m) => m.id === doc.id) ? prev : [...prev, doc],
        );
      }

      if (folder) {
        setMentionedFolders((prev) =>
          prev.some((f) => f.id === folder.id) ? prev : [...prev, folder],
        );
        setMentionedDocs((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const toAdd = collectDocsUnderFolder(folder).filter(
            (d) => !existingIds.has(d.id),
          );
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      closeMention();

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const pos = atIndex !== -1 ? atIndex : newQuestion.length;
          textareaRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [question, setQuestion, textareaRef, closeMention],
  );

  const selectFile = useCallback(
    (doc: Document) => commitMention(doc, undefined),
    [commitMention],
  );

  const selectFolder = useCallback(
    (node: FolderNode) => commitMention(undefined, node),
    [commitMention],
  );

  const removeMentionedDoc = useCallback(
    (id: string) => setMentionedDocs((prev) => prev.filter((d) => d.id !== id)),
    [],
  );

  const removeMentionedFolder = useCallback(
    (id: string) => {
      const node = mentionedFolders.find((f) => f.id === id);
      setMentionedFolders((prev) => prev.filter((f) => f.id !== id));
      if (node) {
        const docIds = new Set(collectDocsUnderFolder(node).map((d) => d.id));
        setMentionedDocs((prev) => prev.filter((d) => !docIds.has(d.id)));
      }
    },
    [mentionedFolders],
  );

  const handleTextareaChange = useCallback(
    (
      e: React.ChangeEvent<HTMLTextAreaElement>,
      onQuestionChange: (val: string) => void,
    ) => {
      const val = e.target.value;
      onQuestionChange(val);

      // Auto-resize the textarea height to fit content
      e.target.style.height = "auto";
      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

      // ── @ detection ───────────────────────────────────────────────────
      const cursor = e.target.selectionStart;
      const textUpToCursor = val.slice(0, cursor);
      const atIndex = textUpToCursor.lastIndexOf("@");

      if (atIndex !== -1) {
        const charBefore = atIndex > 0 ? textUpToCursor[atIndex - 1] : " ";
        if (charBefore === " " || atIndex === 0) {
          const query = textUpToCursor.slice(atIndex + 1);
          if (!query.includes(" ")) {
            setMentionSearch(query);
            setMentionIndex(0);
            if (!mentionOpen) setMentionOpen(true);
            return;
          }
        }
      }

      if (mentionOpen) closeMention();
    },
    [mentionOpen, closeMention],
  );

  const clearMentions = useCallback(() => {
    setMentionedDocs([]);
    setMentionedFolders([]);
  }, []);

  return {
    mentionedDocs,
    mentionedFolders,
    mentionOpen,
    mentionSearch,
    mentionIndex,
    mentionDropdownRef,
    mentionItems,
    setMentionSearch,
    setMentionIndex,
    selectFile,
    selectFolder,
    removeMentionedDoc,
    removeMentionedFolder,
    closeMention,
    handleTextareaChange,
    clearMentions,
  };
}
