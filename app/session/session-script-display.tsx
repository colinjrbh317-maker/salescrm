"use client";

import { useState, useMemo } from "react";
import type { Lead } from "@/lib/types";
import { mergeFields } from "@/lib/merge-fields";
import { parseMarkdownBlocks } from "@/lib/markdown-renderer";
import { RenderedBlock } from "@/app/_components/rendered-block";

interface SessionScriptDisplayProps {
  scriptContent: string | null;
  lead: Lead;
}

export default function SessionScriptDisplay({
  scriptContent,
  lead,
}: SessionScriptDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const merged = useMemo(() => {
    if (!scriptContent) return null;
    return mergeFields(scriptContent, lead);
  }, [scriptContent, lead]);

  if (!scriptContent || !merged) return null;

  const blocks = parseMarkdownBlocks(merged.text);
  const previewLines = merged.text.split("\n").slice(0, 2).join("\n");
  const previewBlocks = parseMarkdownBlocks(previewLines);

  function handleCopy() {
    navigator.clipboard.writeText(merged!.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-300">Script</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-600"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-600"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {expanded
          ? blocks.map((block, i) => <RenderedBlock key={i} block={block} />)
          : previewBlocks.map((block, i) => (
              <RenderedBlock key={i} block={block} />
            ))}
        {!expanded && blocks.length > previewBlocks.length && (
          <p className="text-xs text-slate-500">... click Expand to see more</p>
        )}
      </div>

      {merged.unresolvedFields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
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
  );
}
