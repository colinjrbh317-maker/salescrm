"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/core";

// ============================================================
// Merge Field Highlight Extension
// Decorates {{FIELD}} tokens with styled spans
// ============================================================

const MergeFieldHighlight = Extension.create({
  name: "mergeFieldHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("mergeFieldHighlight"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const regex = /\{\{([^}]+)\}\}/g;
              let match;

              while ((match = regex.exec(node.text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                decorations.push(
                  Decoration.inline(from, to, {
                    class:
                      "rounded bg-amber-600/20 text-amber-400 px-1.5 py-0.5 border border-amber-500/30 font-mono text-sm",
                    "data-merge-field": match[1],
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

// ============================================================
// Types
// ============================================================

interface ScriptEditorProps {
  content: string; // markdown
  onSave: (markdown: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

// ============================================================
// Toolbar Button
// ============================================================

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600/30 text-blue-400"
          : "text-slate-400 hover:bg-slate-700 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-slate-700" />;
}

// ============================================================
// Main Editor
// ============================================================

export function ScriptEditor({
  content,
  onSave,
  onCancel,
  saving,
}: ScriptEditorProps) {
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContent = useRef(content);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      MergeFieldHighlight,
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-slate max-w-none min-h-[500px] px-6 py-4 focus:outline-none " +
          "prose-headings:text-white prose-p:text-slate-300 prose-p:leading-relaxed " +
          "prose-strong:text-white prose-em:text-slate-300 " +
          "prose-ul:text-slate-300 prose-ol:text-slate-300 prose-li:text-slate-300 " +
          "prose-blockquote:border-blue-500/50 prose-blockquote:text-slate-400 " +
          "prose-code:text-emerald-400 prose-code:bg-slate-700 prose-code:rounded prose-code:px-1 " +
          "prose-hr:border-slate-700",
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Auto-save with 2 second debounce
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        const md = (ed.storage as Record<string, any>).markdown.getMarkdown();
        if (md !== lastSavedContent.current) {
          setAutoSaveStatus("saving");
          onSave(md).then(() => {
            lastSavedContent.current = md;
            setAutoSaveStatus("saved");
            setTimeout(() => setAutoSaveStatus("idle"), 2000);
          });
        }
      }, 2000);
    },
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const handleManualSave = useCallback(async () => {
    if (!editor) return;
    const md = (editor.storage as Record<string, any>).markdown.getMarkdown();
    lastSavedContent.current = md;
    await onSave(md);
  }, [editor, onSave]);

  // Keyboard shortcut: Cmd+S / Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleManualSave]);

  if (!editor) return null;

  return (
    <div>
      {/* Fixed Toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-0.5 rounded-t-lg border-b border-slate-700 bg-slate-850 px-3 py-2 bg-slate-800/95 backdrop-blur">
        {/* Text style */}
        <ToolbarButton
          title="Normal text"
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          Text
        </ToolbarButton>
        <ToolbarButton
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </ToolbarButton>

        <ToolbarDivider />

        {/* Inline formatting */}
        <ToolbarButton
          title="Bold (Cmd+B)"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Italic (Cmd+I)"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Underline (Cmd+U)"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
            />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.242 5.992h12m-12 6.003h12m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H4.99m-1.872 6.005v-1.498l1.125-1.502H2.99m1.125 3H2.99m1.125 0v1.498l-1.125 1.503h2.25"
            />
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Block formatting */}
        <ToolbarButton
          title="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25"
            />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <span className="text-xs">---</span>
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auto-save status */}
        <span className="mr-3 text-xs text-slate-500">
          {autoSaveStatus === "saving" && "Saving..."}
          {autoSaveStatus === "saved" && "Saved"}
          {autoSaveStatus === "idle" && ""}
        </span>

        {/* Action buttons */}
        <button
          onClick={handleManualSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="ml-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          Done
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}
