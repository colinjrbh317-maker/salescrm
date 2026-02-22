"use client";

import React, { useState, useCallback, Fragment, type ReactElement } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Script, ScriptComment } from "./page";

// ============================================================
// Types
// ============================================================

interface ScriptViewerProps {
  script: Script;
  comments: ScriptComment[];
  categoryLabel: string;
}

// ============================================================
// Simple Markdown Renderer (no external deps)
// ============================================================

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Find the earliest match among our inline patterns
    const patterns: {
      regex: RegExp;
      render: (match: RegExpMatchArray) => ReactElement;
    }[] = [
      {
        // {{FIELD}} merge fields
        regex: /\{\{([^}]+)\}\}/,
        render: (m) => (
          <span
            key={`mf-${keyIdx++}`}
            className="rounded bg-amber-600/20 px-1.5 py-0.5 text-amber-400 font-mono text-sm border border-amber-500/30"
          >
            {`{{${m[1]}}}`}
          </span>
        ),
      },
      {
        // `inline code`
        regex: /`([^`]+)`/,
        render: (m) => (
          <code
            key={`ic-${keyIdx++}`}
            className="rounded bg-slate-700 px-1.5 py-0.5 text-sm text-emerald-400 font-mono"
          >
            {m[1]}
          </code>
        ),
      },
      {
        // **bold**
        regex: /\*\*([^*]+)\*\*/,
        render: (m) => (
          <strong key={`b-${keyIdx++}`} className="font-semibold text-white">
            {m[1]}
          </strong>
        ),
      },
      {
        // *italic*
        regex: /\*([^*]+)\*/,
        render: (m) => (
          <em key={`i-${keyIdx++}`} className="italic text-slate-300">
            {m[1]}
          </em>
        ),
      },
    ];

    let earliestIndex = remaining.length;
    let earliestPattern: (typeof patterns)[0] | null = null;
    let earliestMatch: RegExpMatchArray | null = null;

    for (const pat of patterns) {
      const match = remaining.match(pat.regex);
      if (match && match.index !== undefined && match.index < earliestIndex) {
        earliestIndex = match.index;
        earliestPattern = pat;
        earliestMatch = match;
      }
    }

    if (!earliestPattern || !earliestMatch || earliestMatch.index === undefined) {
      // No more inline patterns, push the rest as text
      elements.push(remaining);
      break;
    }

    // Push text before the match
    if (earliestIndex > 0) {
      elements.push(remaining.slice(0, earliestIndex));
    }

    // Push the rendered element
    elements.push(earliestPattern.render(earliestMatch));

    // Advance past the match
    remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
  }

  return elements;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code-block"; language: string; lines: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

function parseMarkdownBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Code block (fenced)
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code-block", language, lines: codeLines });
      i++; // skip closing ```
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // Table (lines starting with |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        tableLines.push(lines[i]);
        i++;
      }
      // Parse table: first row = headers, skip separator row, rest = data
      const parseRow = (row: string) =>
        row
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());

      const headers = tableLines.length > 0 ? parseRow(tableLines[0]) : [];
      const isSeparator = (row: string) =>
        /^\|[\s-:|]+\|$/.test(row.trim());

      const dataLines = tableLines
        .slice(1)
        .filter((row) => !isSeparator(row));
      const rows = dataLines.map(parseRow);
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    // Regular paragraph - collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !lines[i].startsWith("> ") &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join("\n") });
    }
  }

  return blocks;
}

function RenderedBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const sizeClass =
        block.level === 1
          ? "text-2xl font-bold text-white mt-6 mb-3"
          : block.level === 2
          ? "text-xl font-semibold text-white mt-5 mb-2"
          : "text-lg font-medium text-white mt-4 mb-2";
      const children = renderInlineMarkdown(block.text);
      if (block.level === 1) return <h1 className={sizeClass}>{children}</h1>;
      if (block.level === 2) return <h2 className={sizeClass}>{children}</h2>;
      if (block.level === 3) return <h3 className={sizeClass}>{children}</h3>;
      if (block.level === 4) return <h4 className={sizeClass}>{children}</h4>;
      if (block.level === 5) return <h5 className={sizeClass}>{children}</h5>;
      return <h6 className={sizeClass}>{children}</h6>;
    }

    case "paragraph":
      return (
        <p className="text-slate-300 leading-relaxed">
          {renderInlineMarkdown(block.text)}
        </p>
      );

    case "blockquote":
      return (
        <blockquote className="border-l-4 border-blue-500/50 pl-4 py-1 my-2">
          {block.lines.map((line, i) => (
            <p key={i} className="text-slate-400 italic leading-relaxed">
              {renderInlineMarkdown(line)}
            </p>
          ))}
        </blockquote>
      );

    case "unordered-list":
      return (
        <ul className="list-disc list-inside space-y-1 text-slate-300 ml-2">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );

    case "ordered-list":
      return (
        <ol className="list-decimal list-inside space-y-1 text-slate-300 ml-2">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );

    case "code-block":
      return (
        <pre className="rounded-lg bg-slate-950 border border-slate-700 p-4 overflow-x-auto my-2">
          <code className="text-sm text-emerald-400 font-mono">
            {block.lines.join("\n")}
          </code>
        </pre>
      );

    case "table":
      return (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full divide-y divide-slate-700 text-sm">
            <thead>
              <tr>
                {block.headers.map((header, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-800"
                  >
                    {renderInlineMarkdown(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-300">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "hr":
      return <hr className="border-slate-700 my-4" />;

    default:
      return null;
  }
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

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("scripts")
      .update({ content: editContent, updated_at: new Date().toISOString() })
      .eq("id", script.id);

    if (!error) {
      setContent(editContent);
      setMode("view");
    }
    setSaving(false);
  };

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
            {mode === "view" ? (
              <button
                onClick={() => {
                  setEditContent(content);
                  setMode("edit");
                }}
                className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        {mode === "edit" ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[600px] rounded-md border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-300 font-mono leading-relaxed placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        ) : (
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
        )}
      </div>

      {/* File path reference (subtle) */}
      <p className="mt-3 text-xs text-slate-600">
        Source: {script.file_path}
      </p>
    </div>
  );
}
