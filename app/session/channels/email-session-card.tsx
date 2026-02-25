"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Lead, Outcome } from "@/lib/types";
import { PRIORITY_COLORS } from "@/lib/types";
import { CHANNEL_OUTCOMES } from "@/lib/channel-outcomes";
import { mergeFields } from "@/lib/merge-fields";
import LeadNameLink from "../lead-name-link";

// ============================================================
// Types
// ============================================================

interface EmailSessionCardProps {
  lead: Lead;
  scriptContent: string | null;
  onOutcome: (outcome: Outcome, note: string | null) => Promise<boolean>;
  onSnooze: () => void;
  onOpenLeadDetails: () => void;
}

// ============================================================
// Component
// ============================================================

export default function EmailSessionCard({
  lead,
  scriptContent,
  onOutcome,
  onSnooze,
  onOpenLeadDetails,
}: EmailSessionCardProps) {
  // --- Merge script content with lead data ---
  const merged = scriptContent ? mergeFields(scriptContent, lead) : null;

  // --- State ---
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(merged?.text ?? "");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const submittingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outcomes = CHANNEL_OUTCOMES.email;
  const briefing = lead.ai_briefing;

  // --- Submitting timeout fallback (5s auto-reset) ---
  useEffect(() => {
    if (submitting) {
      submittingTimeoutRef.current = setTimeout(() => {
        setSubmitting(false);
      }, 5000);
    }
    return () => {
      if (submittingTimeoutRef.current) {
        clearTimeout(submittingTimeoutRef.current);
      }
    };
  }, [submitting]);

  // --- Copy handlers ---
  const copySubject = useCallback(() => {
    navigator.clipboard.writeText(subject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  }, [subject]);

  const copyBody = useCallback(() => {
    navigator.clipboard.writeText(body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  }, [body]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, channel: "email" }),
      });

      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const error =
          typeof data.error === "string"
            ? data.error
            : `Generation failed (${res.status})`;
        setGenError(error);
        return;
      }

      setSubject(typeof data.subject === "string" ? data.subject : "");
      setBody(typeof data.body === "string" ? data.body : "");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }, [lead.id]);

  // --- Log outcome ---
  const handleLog = useCallback(async () => {
    if (!selectedOutcome || submitting) return;
    setSubmitting(true);
    const success = await onOutcome(selectedOutcome, null);
    if (!success) {
      setSubmitting(false);
    }
  }, [onOutcome, selectedOutcome, submitting]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1") {
        setSelectedOutcome(outcomes[0].key);
      } else if (e.key === "2") {
        setSelectedOutcome(outcomes[1].key);
      } else if (e.key === "3") {
        setSelectedOutcome(outcomes[2].key);
      } else if (e.key === "4") {
        setSelectedOutcome(outcomes[3].key);
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
  }, [handleLog, onSnooze, outcomes, selectedOutcome, submitting]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="flex gap-4">
      {/* ============ MAIN COMPOSE AREA ============ */}
      <div className="min-w-0 flex-1 space-y-3">
        {/* --- Lead header --- */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <LeadNameLink
                  lead={lead}
                  onOpenLeadDetails={onOpenLeadDetails}
                  className="text-lg font-semibold"
                />
                {lead.priority && (
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                      PRIORITY_COLORS[lead.priority] ??
                      "bg-slate-600 text-slate-200"
                    }`}
                  >
                    {lead.priority}
                  </span>
                )}
              </div>
              {lead.email && (
                <p className="mt-0.5 text-sm text-blue-400">{lead.email}</p>
              )}
              {!lead.email && (
                <p className="mt-0.5 text-sm text-amber-400">
                  No email address on file
                </p>
              )}
            </div>
          </div>
        </div>

        {/* --- Subject line --- */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Subject
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line..."
                className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={copySubject}
                className="shrink-0 rounded border border-slate-600 bg-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white"
              >
                {copiedSubject ? "Copied!" : "Copy Subject"}
              </button>
            </div>
          </div>

          {/* --- Email body --- */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Body
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? "Generating..." : body ? "Regenerate" : "Generate"}
                </button>
                <button
                  onClick={copyBody}
                  className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white"
                >
                  {copiedBody ? "Copied!" : "Copy Body"}
                </button>
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email..."
              rows={12}
              className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm leading-relaxed text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none resize-y"
            />
            {merged && merged.unresolvedFields.length > 0 && (
              <p className="mt-1 text-xs text-amber-400">
                Unresolved fields: {merged.unresolvedFields.join(", ")}
              </p>
            )}
            {genError && (
              <p className="mt-1 text-xs text-red-400">{genError}</p>
            )}
          </div>
        </div>

        {/* --- Outcome buttons --- */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Log Outcome</h3>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {outcomes.map((o) => (
              <button
                key={o.key}
                onClick={() => setSelectedOutcome(o.key)}
                className={`rounded-lg py-2.5 text-sm font-semibold text-white transition ${
                  o.color
                } ${
                  selectedOutcome === o.key
                    ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                    : ""
                }`}
              >
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-black/20 text-xs font-mono">
                  {o.shortcut}
                </span>
                {o.label}
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
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? (
                "Logging..."
              ) : (
                <>
                  Log
                  <span className="ml-1.5 inline-flex items-center justify-center rounded bg-black/20 px-1 py-0.5 text-[10px] font-mono">
                    {"\u21B5"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============ SIDE PANEL ============ */}
      <div className="hidden w-64 shrink-0 space-y-3 lg:block">
        {/* Business info */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Lead Info
          </h3>
          <p className="text-sm font-medium text-white">{lead.name}</p>
          {lead.category && (
            <p className="mt-0.5 text-xs text-slate-400">{lead.category}</p>
          )}
          {lead.city && (
            <p className="mt-0.5 text-xs text-slate-400">{lead.city}</p>
          )}
          {lead.website && (
            <a
              href={
                lead.website.startsWith("http")
                  ? lead.website
                  : `https://${lead.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
              {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          {lead.owner_name && (
            <div className="mt-2 border-t border-slate-700 pt-2">
              <p className="text-xs text-slate-500">Owner</p>
              <p className="text-sm text-white">{lead.owner_name}</p>
            </div>
          )}
        </div>

        {/* AI Briefing summary */}
        {briefing && (
          <div className="rounded-lg border border-slate-700 bg-slate-800">
            <button
              onClick={() => setShowBriefing(!showBriefing)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                AI Briefing
              </h3>
              <svg
                className={`h-3 w-3 text-slate-500 transition-transform ${
                  showBriefing ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
            {showBriefing && (
              <div className="border-t border-slate-700 px-4 pb-3 pt-2 space-y-2">
                {briefing.summary && (
                  <p className="text-xs leading-relaxed text-slate-400">
                    {briefing.summary}
                  </p>
                )}
                {briefing.talking_points &&
                  briefing.talking_points.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-300">
                      {briefing.talking_points.map((tp, i) => (
                        <li key={i}>{tp}</li>
                      ))}
                    </ul>
                  )}
                {briefing.objections && briefing.objections.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-500">
                      Objections
                    </p>
                    <ul className="space-y-0.5">
                      {briefing.objections.map((obj, i) => (
                        <li
                          key={i}
                          className="rounded border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-xs text-amber-300"
                        >
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
