"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Lead, Outcome } from "@/lib/types";
import { CHANNEL_OUTCOMES } from "@/lib/channel-outcomes";
import { scoreCurrentMoment } from "@/lib/call-timing";
import { mergeFields } from "@/lib/merge-fields";
import LeadNameLink from "../lead-name-link";

// ============================================================
// Props
// ============================================================

interface CallSessionCardProps {
  lead: Lead;
  scriptContent: string | null;
  onOutcome: (outcome: Outcome, note: string | null) => Promise<boolean>;
  onSnooze: () => void;
  onOpenLeadDetails: () => void;
}

// ============================================================
// Constants
// ============================================================

const CALL_OUTCOMES = CHANNEL_OUTCOMES.call;

const TIMING_COLORS = {
  emerald: "border-emerald-700/50 bg-emerald-900/20 text-emerald-400",
  blue: "border-blue-700/50 bg-blue-900/20 text-blue-400",
  amber: "border-amber-700/50 bg-amber-900/20 text-amber-400",
  slate: "border-slate-600/50 bg-slate-700/20 text-slate-400",
} as const;

const SUBMIT_TIMEOUT_MS = 5000;

// ============================================================
// Component
// ============================================================

export default function CallSessionCard({
  lead,
  scriptContent,
  onOutcome,
  onSnooze,
  onOpenLeadDetails,
}: CallSessionCardProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timing = scoreCurrentMoment(lead);
  const briefing = lead.ai_briefing;

  // Merge script content with lead data
  const mergedScript = scriptContent ? mergeFields(scriptContent, lead) : null;

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  const copyPhone = useCallback(() => {
    if (!lead.phone) return;
    navigator.clipboard.writeText(lead.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [lead.phone]);

  const handleLog = useCallback(async () => {
    if (!selectedOutcome || submitting) return;
    setSubmitting(true);

    // 5-second timeout fallback
    submitTimeoutRef.current = setTimeout(() => {
      setSubmitting(false);
    }, SUBMIT_TIMEOUT_MS);

    const success = await onOutcome(selectedOutcome, note.trim() || null);

    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }

    if (!success) {
      setSubmitting(false);
    }
  }, [note, onOutcome, selectedOutcome, submitting]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  // ----------------------------------------------------------
  // Keyboard shortcuts: 1-4 = outcomes, S = snooze, Enter = log
  // ----------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const outcomeIdx = parseInt(e.key, 10);
      if (outcomeIdx >= 1 && outcomeIdx <= CALL_OUTCOMES.length) {
        setSelectedOutcome(CALL_OUTCOMES[outcomeIdx - 1].key);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        onSnooze();
      } else if (e.key === "Enter" && selectedOutcome && !submitting) {
        e.preventDefault();
        void handleLog();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleLog, onSnooze, selectedOutcome, submitting]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* ============ SPLIT VIEW: Lead Info + Script ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ---- LEFT SIDE: Lead info (3 cols) ---- */}
        <div className="lg:col-span-3 space-y-3">
          {/* Phone hero card */}
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
            {/* Large phone number */}
            {lead.phone ? (
              <div className="flex items-center gap-3">
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-2 text-2xl font-bold text-blue-400 transition hover:text-blue-300"
                >
                  <svg
                    className="h-6 w-6 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                    />
                  </svg>
                  {lead.phone}
                </a>
                <button
                  onClick={copyPhone}
                  className="rounded-md border border-slate-600 bg-slate-700/50 p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                  title="Copy phone number"
                >
                  {copied ? (
                    <svg
                      className="h-5 w-5 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                      />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <p className="text-lg font-medium text-slate-500">
                No phone number
              </p>
            )}

            {/* Timing badge */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded border px-2.5 py-1 text-sm font-medium ${TIMING_COLORS[timing.color]}`}
              >
                {timing.label}
                {timing.matchingWindow && (
                  <span className="ml-1.5 opacity-60">
                    {timing.matchingWindow.label}
                  </span>
                )}
              </span>
            </div>

            {/* Owner + Business name */}
            <div className="mt-4 space-y-1">
              <LeadNameLink
                lead={lead}
                onOpenLeadDetails={onOpenLeadDetails}
                className="text-lg font-semibold"
              />
              {lead.owner_name && (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Owner:</span>{" "}
                  {lead.owner_name}
                </p>
              )}
              {(lead.category || lead.city) && (
                <p className="text-sm text-slate-400">
                  {[lead.category, lead.city].filter(Boolean).join(" \u2022 ")}
                </p>
              )}
            </div>
          </div>

          {/* AI Briefing + Talking Points (expanded by default for calls) */}
          {briefing && (
            <div className="rounded-lg border border-slate-700 bg-slate-800">
              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-300">
                  AI Briefing
                </h3>
              </div>
              <div className="space-y-3 border-t border-slate-700 px-4 pb-4 pt-3">
                {briefing.summary && (
                  <p className="text-sm text-slate-400">{briefing.summary}</p>
                )}

                {briefing.talking_points &&
                  briefing.talking_points.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                        Talking Points
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-sm text-slate-300">
                        {briefing.talking_points.map(
                          (tp: string, i: number) => (
                            <li key={i}>{tp}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                {briefing.objections && briefing.objections.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-amber-500">
                      Potential Objections
                    </p>
                    <ul className="space-y-1">
                      {briefing.objections.map((obj: string, i: number) => (
                        <li
                          key={i}
                          className="rounded border border-amber-600/30 bg-amber-600/10 px-2 py-1 text-sm text-amber-300"
                        >
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note input */}
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Call Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note about this call..."
              className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ---- RIGHT SIDE: Script panel (2 cols) ---- */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-slate-700 bg-slate-800 lg:sticky lg:top-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            <div className="border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
                Call Script
              </h3>
            </div>

            <div className="p-4">
              {mergedScript ? (
                <div className="space-y-3">
                  {/* Unresolved field warnings */}
                  {mergedScript.unresolvedFields.length > 0 && (
                    <div className="rounded border border-amber-600/30 bg-amber-600/10 px-3 py-2 text-xs text-amber-300">
                      Missing fields:{" "}
                      {mergedScript.unresolvedFields.join(", ")}
                    </div>
                  )}
                  {/* Script text with merge field highlighting */}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                    {mergedScript.text.split(/(\{\{[^}]+\}\})/).map((segment, i) =>
                      segment.match(/^\{\{[^}]+\}\}$/) ? (
                        <span
                          key={i}
                          className="rounded bg-amber-600/20 px-1 py-0.5 text-amber-300"
                        >
                          {segment}
                        </span>
                      ) : (
                        <span key={i}>{segment}</span>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg
                    className="mb-2 h-8 w-8 text-slate-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  <p className="text-sm text-slate-500">No script assigned</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Assign a script to this session for guided calls
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============ BOTTOM: Outcomes (full width) ============ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Log Outcome</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CALL_OUTCOMES.map((co) => (
            <button
              key={co.key}
              onClick={() => setSelectedOutcome(co.key)}
              className={`rounded-lg py-2.5 text-sm font-semibold text-white transition ${co.color} ${
                selectedOutcome === co.key
                  ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                  : ""
              }`}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-black/20 text-xs font-mono">
                {co.shortcut}
              </span>
              {co.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSnooze}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-600"
          >
            <span className="mr-1.5 inline-flex items-center justify-center rounded bg-black/20 px-1 py-0.5 text-[10px] font-mono">
              S
            </span>
            Snooze
          </button>
          <button
            onClick={() => void handleLog()}
            disabled={!selectedOutcome || submitting}
            className="flex-[2] rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? (
              "Logging..."
            ) : (
              <>
                Log Outcome
                <span className="ml-1.5 inline-flex items-center justify-center rounded bg-black/20 px-1 py-0.5 text-[10px] font-mono">
                  {"\u21B5"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
