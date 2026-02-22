"use client";

import { useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CommentWithScript } from "./page";

// ============================================================
// Types
// ============================================================

type FilterStatus = "pending" | "applied" | "dismissed" | "all";

interface GroupedComments {
  scriptId: string;
  scriptTitle: string;
  scriptFilePath: string;
  scriptCategory: string;
  comments: CommentWithScript[];
}

// ============================================================
// Helpers
// ============================================================

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================
// Icons
// ============================================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || "h-4 w-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || "h-4 w-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
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
        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
      />
    </svg>
  );
}

// ============================================================
// Main Component
// ============================================================

export function CommentBoard({
  initialComments,
}: {
  initialComments: CommentWithScript[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("pending");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // -----------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------

  const counts = useMemo(() => {
    let pending = 0;
    let applied = 0;
    let dismissed = 0;
    for (const c of comments) {
      if (c.status === "pending") pending++;
      else if (c.status === "applied") applied++;
      else if (c.status === "dismissed") dismissed++;
    }
    return { pending, applied, dismissed, total: comments.length };
  }, [comments]);

  const filteredComments = useMemo(() => {
    if (activeFilter === "all") return comments;
    return comments.filter((c) => c.status === activeFilter);
  }, [comments, activeFilter]);

  const groupedByScript = useMemo(() => {
    const map = new Map<string, GroupedComments>();
    for (const c of filteredComments) {
      let group = map.get(c.script_id);
      if (!group) {
        group = {
          scriptId: c.script_id,
          scriptTitle: c.script_title,
          scriptFilePath: c.script_file_path,
          scriptCategory: c.script_category,
          comments: [],
        };
        map.set(c.script_id, group);
      }
      group.comments.push(c);
    }
    // Sort comments within each group by paragraph_index
    for (const group of map.values()) {
      group.comments.sort((a, b) => a.paragraph_index - b.paragraph_index);
    }
    // Return groups sorted by script title
    return Array.from(map.values()).sort((a, b) =>
      a.scriptTitle.localeCompare(b.scriptTitle)
    );
  }, [filteredComments]);

  // -----------------------------------------------------------
  // Actions
  // -----------------------------------------------------------

  const updateCommentStatus = useCallback(
    async (commentId: string, newStatus: "applied" | "dismissed") => {
      setUpdatingIds((prev) => new Set(prev).add(commentId));

      const supabase = createClient();
      const { error } = await supabase
        .from("script_comments")
        .update({ status: newStatus })
        .eq("id", commentId);

      if (!error) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, status: newStatus } : c
          )
        );
      }

      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    },
    []
  );

  const handleBulkApply = useCallback(async () => {
    const targetComments = filteredComments.filter(
      (c) => c.status === "pending"
    );
    if (targetComments.length === 0) return;

    setBulkUpdating(true);
    const supabase = createClient();
    const ids = targetComments.map((c) => c.id);

    const { error } = await supabase
      .from("script_comments")
      .update({ status: "applied" })
      .in("id", ids);

    if (!error) {
      setComments((prev) =>
        prev.map((c) =>
          ids.includes(c.id) ? { ...c, status: "applied" } : c
        )
      );
    }

    setBulkUpdating(false);
  }, [filteredComments]);

  // -----------------------------------------------------------
  // Export: Plain Text
  // -----------------------------------------------------------

  const generatePlainText = useCallback(() => {
    let text = "=== SCRIPT CHANGES ===\n";

    for (const group of groupedByScript) {
      text += `\n## ${group.scriptFilePath}\n`;
      for (const c of group.comments) {
        const para = truncate(c.paragraph_text, 120);
        text += `- Paragraph ${c.paragraph_index}: "${para}"\n`;
        text += `  → Change: "${c.comment}"\n\n`;
      }
    }

    return text.trimEnd();
  }, [groupedByScript]);

  // -----------------------------------------------------------
  // Export: JSON
  // -----------------------------------------------------------

  const generateJSON = useCallback(() => {
    const changes = groupedByScript.map((group) => ({
      file: group.scriptFilePath,
      script_title: group.scriptTitle,
      comments: group.comments.map((c) => ({
        paragraph_index: c.paragraph_index,
        paragraph_text: c.paragraph_text,
        comment: c.comment,
        comment_id: c.id,
      })),
    }));

    return JSON.stringify(
      {
        changes,
        exported_at: new Date().toISOString(),
        total_comments: filteredComments.length,
      },
      null,
      2
    );
  }, [groupedByScript, filteredComments.length]);

  // -----------------------------------------------------------
  // Copy to clipboard
  // -----------------------------------------------------------

  const copyToClipboard = useCallback(
    async (format: "text" | "json") => {
      const content =
        format === "text" ? generatePlainText() : generateJSON();

      try {
        await navigator.clipboard.writeText(content);
        setCopiedFormat(format);
        setTimeout(() => setCopiedFormat(null), 2000);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedFormat(format);
        setTimeout(() => setCopiedFormat(null), 2000);
      }
    },
    [generatePlainText, generateJSON]
  );

  // -----------------------------------------------------------
  // Filter tabs config
  // -----------------------------------------------------------

  const FILTER_TABS: { key: FilterStatus; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "applied", label: "Applied", count: counts.applied },
    { key: "dismissed", label: "Dismissed", count: counts.dismissed },
    { key: "all", label: "All", count: counts.total },
  ];

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------

  const hasPendingInView = filteredComments.some(
    (c) => c.status === "pending"
  );

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-6 rounded-lg border border-slate-700 bg-slate-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-600/20 text-xs font-bold text-amber-400">
            {counts.pending}
          </span>
          <span className="text-sm text-slate-400">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-bold text-emerald-400">
            {counts.applied}
          </span>
          <span className="text-sm text-slate-400">Applied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-600/20 text-xs font-bold text-slate-400">
            {counts.dismissed}
          </span>
          <span className="text-sm text-slate-400">Dismissed</span>
        </div>
        <div className="ml-auto text-sm text-slate-500">
          {counts.total} total comment{counts.total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filter tabs + action buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === tab.key
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 text-xs ${
                  activeFilter === tab.key
                    ? "text-slate-300"
                    : "text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Copy as Text */}
          <button
            onClick={() => copyToClipboard("text")}
            disabled={filteredComments.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ClipboardIcon className="h-3.5 w-3.5" />
            {copiedFormat === "text" ? "Copied!" : "Copy as Text"}
          </button>

          {/* Copy as JSON */}
          <button
            onClick={() => copyToClipboard("json")}
            disabled={filteredComments.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ClipboardIcon className="h-3.5 w-3.5" />
            {copiedFormat === "json" ? "Copied!" : "Copy as JSON"}
          </button>

          {/* Bulk apply */}
          {hasPendingInView && (
            <button
              onClick={handleBulkApply}
              disabled={bulkUpdating}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              {bulkUpdating ? "Updating..." : "Mark All as Applied"}
            </button>
          )}
        </div>
      </div>

      {/* Comments grouped by script */}
      {groupedByScript.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 py-16">
          <div className="mb-3 text-slate-600">
            <svg
              className="h-10 w-10"
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
          </div>
          <p className="text-sm font-medium text-white">No comments found</p>
          <p className="mt-1 text-xs text-slate-500">
            {activeFilter === "all"
              ? "No comments have been added to any scripts yet."
              : `No ${activeFilter} comments at the moment.`}
          </p>
        </div>
      )}

      {groupedByScript.map((group) => (
        <section
          key={group.scriptId}
          className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden"
        >
          {/* Script header */}
          <div className="border-b border-slate-700 bg-slate-800/80 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white truncate">
                  {group.scriptTitle}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  {group.scriptFilePath}
                </p>
              </div>
              <span className="flex-shrink-0 inline-flex items-center rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                {group.comments.length} comment
                {group.comments.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Comment cards */}
          <div className="divide-y divide-slate-700/50">
            {group.comments.map((comment) => {
              const isUpdating = updatingIds.has(comment.id);
              const isPending = comment.status === "pending";
              const isApplied = comment.status === "applied";
              const isDismissed = comment.status === "dismissed";

              return (
                <div key={comment.id} className="px-5 py-4">
                  {/* Paragraph context */}
                  <blockquote className="mb-2 border-l-2 border-slate-600 pl-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      <span className="mr-1.5 text-slate-600">
                        P{comment.paragraph_index}
                      </span>
                      {truncate(comment.paragraph_text, 100)}
                    </p>
                  </blockquote>

                  {/* Comment text */}
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {comment.comment}
                  </p>

                  {/* Footer: timestamp + status + actions */}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {formatTimestamp(comment.created_at)}
                      </span>
                      {isApplied && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          <CheckIcon className="h-3 w-3" />
                          Applied
                        </span>
                      )}
                      {isDismissed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-600/20 px-2 py-0.5 text-xs font-medium text-slate-500">
                          <XIcon className="h-3 w-3" />
                          Dismissed
                        </span>
                      )}
                    </div>

                    {/* Action buttons (only for pending) */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateCommentStatus(comment.id, "applied")
                          }
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <CheckIcon className="h-3 w-3" />
                          {isUpdating ? "..." : "Mark Applied"}
                        </button>
                        <button
                          onClick={() =>
                            updateCommentStatus(comment.id, "dismissed")
                          }
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-700/50 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <XIcon className="h-3 w-3" />
                          {isUpdating ? "..." : "Dismiss"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
