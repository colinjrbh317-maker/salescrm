"use client";

import { useState, useMemo } from "react";
import type { Lead } from "@/lib/types";
import { mergeFields } from "@/lib/merge-fields";
import { parseMarkdownBlocks } from "@/lib/markdown-renderer";
import { RenderedBlock } from "@/app/_components/rendered-block";

interface SessionScriptDisplayProps {
  scriptContent: string | null;
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

export default function SessionScriptDisplay({
  scriptContent,
  lead,
  open,
  onClose,
}: SessionScriptDisplayProps) {
  const [copied, setCopied] = useState(false);

  const merged = useMemo(() => {
    if (!scriptContent) return null;
    return mergeFields(scriptContent, lead);
  }, [scriptContent, lead]);

  if (!scriptContent || !merged) return null;

  const blocks = parseMarkdownBlocks(merged.text);

  function handleCopy() {
    navigator.clipboard.writeText(merged!.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform border-l border-slate-700 bg-slate-900 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h3 className="text-base font-semibold text-white">Script</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-600"
            >
              {copied ? "Copied!" : "Copy All"}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-3" style={{ height: "calc(100% - 65px)" }}>
          {blocks.map((block, i) => (
            <RenderedBlock key={i} block={block} />
          ))}

          {merged.unresolvedFields.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {merged.unresolvedFields.map((f) => (
                <span
                  key={f}
                  className="rounded bg-amber-600/20 px-1.5 py-0.5 text-xs text-amber-400 border border-amber-500/30"
                >
                  {`{{${f}}}`} missing
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
