"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";

function getStepColor(outcome: string): string {
  if (
    outcome.startsWith("Failed") ||
    outcome.startsWith("No ") ||
    outcome.includes("not found") ||
    outcome.includes("failed")
  ) {
    return "bg-slate-500";
  }
  if (outcome.startsWith("Skipped")) {
    return "bg-yellow-500";
  }
  return "bg-emerald-500";
}

export function EnrichmentLog({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);

  if (!lead.enriched_at || !lead.enrichment_log || lead.enrichment_log.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Enrichment Log
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {new Date(lead.enriched_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {" "}&middot;{" "}
            {lead.enrichment_log.length} steps
          </p>
        </div>
        <svg
          className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-700 pt-3">
          {lead.enrichment_log.map((entry, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${getStepColor(entry.outcome)}`}
              />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-300">
                  {entry.step}
                </span>
                <span className="mx-1.5 text-xs text-slate-600">&middot;</span>
                <span className="text-xs text-slate-400">{entry.outcome}</span>
                {entry.detail && (
                  <p className="mt-0.5 text-xs text-slate-500">{entry.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
