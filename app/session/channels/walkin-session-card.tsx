"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Lead, Outcome } from "@/lib/types";
import {
  PRIORITY_COLORS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
} from "@/lib/types";
import { WALKIN_OUTCOMES } from "@/lib/channel-outcomes";
import { mergeFields } from "@/lib/merge-fields";
import SessionNotes from "../session-notes";
import LeadNameLink from "../lead-name-link";

// ============================================================
// Helpers
// ============================================================

const WALKIN_TIPS = [
  "Arrive during business hours",
  "Ask for the owner by name",
  "Leave materials if owner unavailable",
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function buildMapsUrl(lead: Lead): string {
  const parts = [lead.address, lead.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts || lead.name)}`;
}

// ============================================================
// Props
// ============================================================

interface WalkinSessionCardProps {
  lead: Lead;
  userId: string;
  scriptContent: string | null;
  onOutcome: (outcome: Outcome, note: string | null) => Promise<boolean>;
  onSnooze: () => void;
  onOpenLeadDetails: () => void;
}

// ============================================================
// Component
// ============================================================

export default function WalkinSessionCard({
  lead,
  userId,
  scriptContent,
  onOutcome,
  onSnooze,
  onOpenLeadDetails,
}: WalkinSessionCardProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [showScript, setShowScript] = useState(false);

  const briefing = lead.ai_briefing;
  const mapsUrl = buildMapsUrl(lead);

  // Merge script fields with lead data
  const mergedScript = useMemo(() => {
    if (!scriptContent) return null;
    return mergeFields(scriptContent, lead);
  }, [scriptContent, lead]);

  // Format google hours for display
  const formattedHours = useMemo(() => {
    if (!lead.google_hours?.weekday_text) return null;
    return lead.google_hours.weekday_text;
  }, [lead.google_hours]);

  // ---- Log handler with 5s timeout fallback ----
  const handleLog = useCallback(async () => {
    if (!selectedOutcome) return;
    setSubmitting(true);

    const timeout = setTimeout(() => {
      setSubmitting(false);
    }, 5000);

    try {
      const success = await onOutcome(selectedOutcome, note.trim() || null);
      clearTimeout(timeout);
      if (!success) {
        setSubmitting(false);
      }
    } catch {
      clearTimeout(timeout);
      setSubmitting(false);
    }
  }, [note, onOutcome, selectedOutcome]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1") {
        setSelectedOutcome(WALKIN_OUTCOMES[0].key);
      } else if (e.key === "2") {
        setSelectedOutcome(WALKIN_OUTCOMES[1].key);
      } else if (e.key === "3") {
        setSelectedOutcome(WALKIN_OUTCOMES[2].key);
      } else if (e.key === "4") {
        setSelectedOutcome(WALKIN_OUTCOMES[3].key);
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

  return (
    <div className="space-y-3">
      {/* ============ ADDRESS HEADER ============ */}
      <div className="rounded-lg border border-amber-700/40 bg-slate-800 p-5">
        {/* Business name + badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {/* Walk-in badge */}
              <span className="rounded bg-amber-600/30 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30">
                Walk-In
              </span>
              {lead.priority && (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    PRIORITY_COLORS[lead.priority] ??
                    "bg-slate-600 text-slate-200"
                  }`}
                >
                  {lead.priority}
                </span>
              )}
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  PIPELINE_STAGE_COLORS[lead.pipeline_stage]
                }`}
              >
                {PIPELINE_STAGE_LABELS[lead.pipeline_stage]}
              </span>
            </div>

            <div className="mt-2">
              <LeadNameLink
                lead={lead}
                onOpenLeadDetails={onOpenLeadDetails}
                className="text-lg font-semibold"
              />
            </div>

            {/* Full address with Google Maps link */}
            {(lead.address || lead.city) && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-start gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition"
              >
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                  />
                </svg>
                <span>
                  {[lead.address, lead.city].filter(Boolean).join(", ")}
                </span>
              </a>
            )}

            {lead.category && (
              <p className="mt-1 text-xs text-slate-500">{lead.category}</p>
            )}
          </div>

          {/* Get Directions button */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-600/50 bg-amber-600/20 px-3 py-2 text-xs font-medium text-amber-400 transition hover:bg-amber-600/30 hover:text-amber-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
              />
            </svg>
            Get Directions
          </a>
        </div>

        {/* Owner info */}
        {(lead.owner_name || lead.owner_email) && (
          <div className="mt-3 rounded-md border border-slate-600/50 bg-slate-750 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Owner
            </p>
            <p className="mt-0.5 text-base font-semibold text-white">
              {lead.owner_name ?? "Unknown"}
            </p>
            {lead.owner_email && (
              <a
                href={`mailto:${lead.owner_email}`}
                className="text-sm text-blue-400 hover:underline"
              >
                {lead.owner_email}
              </a>
            )}
          </div>
        )}
      </div>

      {/* ============ MAIN: TWO-COLUMN LAYOUT ============ */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* LEFT: Briefing + Tips + Script + Visit Notes (2/3 width) */}
        <div className="space-y-3 lg:col-span-2">
          {/* AI Briefing + Talking Points (expanded by default) */}
          {briefing && (
            <div className="rounded-lg border border-slate-700 bg-slate-800">
              <button
                onClick={() => setShowBriefing(!showBriefing)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <h3 className="text-sm font-semibold text-slate-300">
                  AI Briefing & Talking Points
                </h3>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform ${showBriefing ? "rotate-180" : ""}`}
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
                <div className="space-y-3 border-t border-slate-700 px-4 pb-4 pt-3">
                  {briefing.summary && (
                    <p className="text-sm text-slate-400">
                      {briefing.summary}
                    </p>
                  )}

                  {briefing.talking_points &&
                    briefing.talking_points.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                          Talking Points
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-sm text-slate-300">
                          {briefing.talking_points.map((tp, i) => (
                            <li key={i}>{tp}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {briefing.objections &&
                    briefing.objections.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-amber-500">
                          Potential Objections
                        </p>
                        <ul className="space-y-1">
                          {briefing.objections.map((obj, i) => (
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
              )}
            </div>
          )}

          {/* Walk-in Tips */}
          <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 p-4">
            <h3 className="text-sm font-semibold text-amber-400">
              Walk-In Tips
            </h3>
            <ul className="mt-2 space-y-1.5">
              {WALKIN_TIPS.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-amber-300/80"
                >
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Door-Knock Script */}
          {mergedScript && (
            <div className="rounded-lg border border-slate-700 bg-slate-800">
              <button
                onClick={() => setShowScript(!showScript)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <h3 className="text-sm font-semibold text-slate-300">
                  Door-Knock Script
                </h3>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform ${showScript ? "rotate-180" : ""}`}
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

              {showScript && (
                <div className="border-t border-slate-700 px-4 pb-4 pt-3">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                    {mergedScript.text.split(/(\{\{[^}]+\}\})/).map((part, i) =>
                      part.startsWith("{{") && part.endsWith("}}") ? (
                        <span
                          key={i}
                          className="rounded bg-amber-600/20 px-1 text-amber-400 border border-amber-500/30"
                        >
                          {part}
                        </span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>

                  {mergedScript.unresolvedFields.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {mergedScript.unresolvedFields.map((f) => (
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
              )}
            </div>
          )}

          {/* Visit Notes textarea */}
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-300">
              Visit Notes
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Take notes during your visit..."
              rows={4}
              className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none resize-y"
            />
          </div>

          {/* Shared Notes (existing component) */}
          <SessionNotes leadId={lead.id} userId={userId} />
        </div>

        {/* RIGHT: Contact Info + Business Hours (1/3 width) */}
        <div className="space-y-3">
          {/* Contact Info */}
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">
              Contact Info
            </h3>
            <div className="space-y-2">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-slate-700 hover:text-blue-300"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
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
              )}

              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-slate-700 hover:text-blue-300 break-all"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                    />
                  </svg>
                  {lead.email}
                </a>
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
                  className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-slate-700 hover:text-blue-300 break-all"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582"
                    />
                  </svg>
                  Website
                </a>
              )}

              {!lead.phone && !lead.email && !lead.website && (
                <p className="text-xs text-slate-500">
                  No contact info available.
                </p>
              )}
            </div>
          </div>

          {/* Business Hours */}
          {formattedHours && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-300">
                Business Hours
              </h3>

              {lead.google_hours?.open_now !== undefined && (
                <div className="mb-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      lead.google_hours.open_now
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {lead.google_hours.open_now
                      ? "Open Now"
                      : "Closed Now"}
                  </span>
                </div>
              )}

              <ul className="space-y-1">
                {formattedHours.map((line, i) => {
                  const today = new Date().getDay();
                  const isToday = line
                    .toLowerCase()
                    .startsWith(DAY_NAMES[today].toLowerCase());
                  return (
                    <li
                      key={i}
                      className={`text-xs ${
                        isToday
                          ? "font-semibold text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      {line}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Google Rating */}
          {lead.google_rating != null && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">
                Google Rating
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400">
                  {lead.google_rating}
                </span>
                <span className="text-sm text-slate-500">/ 5</span>
                {lead.review_count != null && (
                  <span className="text-xs text-slate-500">
                    ({lead.review_count} reviews)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ LOG OUTCOME ============ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Log Visit Outcome</h3>

        <div className="grid grid-cols-2 gap-2">
          {WALKIN_OUTCOMES.map((wo) => (
            <button
              key={wo.key}
              onClick={() => setSelectedOutcome(wo.key)}
              className={`rounded-lg py-2.5 text-sm font-semibold text-white transition ${
                wo.color
              } ${
                selectedOutcome === wo.key
                  ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                  : ""
              }`}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-black/20 text-xs font-mono">
                {wo.shortcut}
              </span>
              {wo.label}
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
            className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
          >
            {submitting ? (
              "Logging..."
            ) : (
              <>
                Log Visit
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
