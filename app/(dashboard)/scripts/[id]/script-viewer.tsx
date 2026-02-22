"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Script, ScriptComment } from "./page";
import { ScriptEditor } from "./script-editor";
import type { Block } from "@/lib/markdown-renderer";
import { parseMarkdownBlocks, renderInlineMarkdown } from "@/lib/markdown-renderer";
import { RenderedBlock } from "@/app/_components/rendered-block";

// ============================================================
// Types
// ============================================================

interface ScriptViewerProps {
  script: Script;
  comments: ScriptComment[];
  categoryLabel: string;
}

// ============================================================
// Comment icon SVG
// ============================================================

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || "h-4 w-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
      />
    </svg>
  );
}

// ============================================================
// Paragraph with comment interaction
// ============================================================

function ParagraphBlock({
  block,
  paragraphIndex,
  comments,
  scriptId,
  onCommentAdded,
}: {
  block: Block;
  paragraphIndex: number;
  comments: ScriptComment[];
  scriptId: string;
  onCommentAdded: () => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const paragraphComments = comments.filter(
    (c) => c.paragraph_index === paragraphIndex
  );
  const commentCount = paragraphComments.length;

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);

    const supabase = createClient();

    // Get paragraph text for context
    let paragraphText = "";
    if (block.type === "paragraph") paragraphText = block.text;
    else if (block.type === "heading") paragraphText = block.text;
    else if (block.type === "blockquote") paragraphText = block.lines.join("\n");
    else if (block.type === "unordered-list" || block.type === "ordered-list")
      paragraphText = block.items.join("\n");
    else if (block.type === "code-block") paragraphText = block.lines.join("\n");
    else if (block.type === "table")
      paragraphText = [block.headers.join(" | "), ...block.rows.map((r) => r.join(" | "))].join("\n");

    const { error } = await supabase.from("script_comments").insert({
      script_id: scriptId,
      paragraph_index: paragraphIndex,
      paragraph_text: paragraphText.slice(0, 500),
      comment: commentText.trim(),
    });

    if (!error) {
      setCommentText("");
      setShowInput(false);
      onCommentAdded();
    }

    setSubmitting(false);
  };

  return (
    <div className="group relative pl-4 border-l-2 border-transparent hover:border-blue-500 transition-colors">
      {/* Comment indicator + hover button */}
      <div className="absolute -left-3 top-1 flex items-center gap-1">
        {commentCount > 0 && (
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
            title={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
          >
            {commentCount}
          </button>
        )}
        {commentCount === 0 && (
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex h-5 w-5 items-center justify-center rounded-full text-slate-600 opacity-0 group-hover:opacity-100 hover:text-blue-400 hover:bg-slate-800 transition-all"
            title="Add comment"
          >
            <CommentIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Rendered content */}
      <RenderedBlock block={block} />

      {/* Existing comments */}
      {paragraphComments.length > 0 && (
        <div className="mt-2 space-y-2">
          {paragraphComments.map((c) => (
            <div
              key={c.id}
              className="rounded-md border border-blue-500/20 bg-blue-950/30 px-3 py-2 text-sm"
            >
              <p className="text-blue-300">{c.comment}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(c.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {c.status !== "pending" && (
                  <span
                    className={`ml-2 ${
                      c.status === "applied"
                        ? "text-emerald-500"
                        : "text-slate-600"
                    }`}
                  >
                    {c.status}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Comment input */}
      {showInput && (
        <div className="mt-2 rounded-md border border-slate-700 bg-slate-800 p-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment on this section..."
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            rows={3}
            autoFocus
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !commentText.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Adding..." : "Add Comment"}
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setCommentText("");
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main ScriptViewer Component
// ============================================================

export function ScriptViewer({
  script,
  comments: initialComments,
  categoryLabel,
}: ScriptViewerProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [content, setContent] = useState(script.content);
  const [editContent, setEditContent] = useState(script.content);
  const [comments, setComments] = useState(initialComments);
  const [saving, setSaving] = useState(false);

  const blocks = parseMarkdownBlocks(content);

  const CATEGORY_COLORS: Record<string, string> = {
    "cold-email": "bg-blue-600/20 text-blue-400 border-blue-500/30",
    "social-dm": "bg-purple-600/20 text-purple-400 border-purple-500/30",
    "cold-call": "bg-amber-600/20 text-amber-400 border-amber-500/30",
    "in-person": "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
    "response-handling":
      "bg-orange-600/20 text-orange-400 border-orange-500/30",
    closing: "bg-red-600/20 text-red-400 border-red-500/30",
    "post-sale": "bg-teal-600/20 text-teal-400 border-teal-500/30",
    sops: "bg-slate-600/20 text-slate-400 border-slate-500/30",
    overview: "bg-indigo-600/20 text-indigo-400 border-indigo-500/30",
  };

  const categoryColor =
    CATEGORY_COLORS[script.category] ||
    "bg-slate-600/20 text-slate-400 border-slate-500/30";

  const refreshComments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("script_comments")
      .select("*")
      .eq("script_id", script.id)
      .order("paragraph_index", { ascending: true });
    if (data) {
      setComments(data as ScriptComment[]);
    }
  }, [script.id]);

  const handleSave = useCallback(async (markdown?: string) => {
    setSaving(true);
    const md = markdown ?? editContent;
    const supabase = createClient();
    const { error } = await supabase
      .from("scripts")
      .update({ content: md, updated_at: new Date().toISOString() })
      .eq("id", script.id);

    if (!error) {
      setContent(md);
      setEditContent(md);
    }
    setSaving(false);
  }, [editContent, script.id]);

  const handleDoneEditing = useCallback(() => {
    setMode("view");
  }, []);

  const handleCancelEdit = () => {
    setEditContent(content);
    setMode("view");
  };

  const totalComments = comments.length;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        {/* Back link */}
        <Link
          href="/scripts"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
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
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
          Back to Scripts
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{script.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${categoryColor}`}
              >
                {categoryLabel}
              </span>
              {totalComments > 0 && (
                <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                  <CommentIcon className="h-4 w-4" />
                  {totalComments} comment{totalComments !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            {mode === "view" && (
              <button
                onClick={() => {
                  setEditContent(content);
                  setMode("edit");
                }}
                className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
        {mode === "edit" ? (
          <ScriptEditor
            content={editContent}
            onSave={handleSave}
            onCancel={handleDoneEditing}
            saving={saving}
          />
        ) : (
          <div className="p-6">
            <div className="space-y-3">
              {blocks.map((block, idx) => (
                <ParagraphBlock
                  key={idx}
                  block={block}
                  paragraphIndex={idx}
                  comments={comments}
                  scriptId={script.id}
                  onCommentAdded={refreshComments}
                />
              ))}
              {blocks.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-8">
                  This script has no content yet. Click Edit to add content.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File path reference (subtle) */}
      <p className="mt-3 text-xs text-slate-600">
        Source: {script.file_path}
      </p>
    </div>
  );
}
