"use client";

import { useState } from "react";
import type { Lead, Outcome } from "@/lib/types";
import {
  PRIORITY_COLORS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
} from "@/lib/types";
import { checkMissingData } from "@/lib/missing-data-check";
import SessionMissingData from "./session-missing-data";
import SessionScriptDisplay from "./session-script-display";
import SessionNotes from "./session-notes";

// ============================================================
// Helpers
// ============================================================

/** Build a clickable URL from a social handle or URL */
function buildSocialUrl(
  platform: "instagram" | "tiktok" | "facebook",
  value: string
): string {
  // Already a full URL
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const handle = value.replace(/^@/, "");

  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "facebook":
      return `https://www.facebook.com/${handle}`;
  }
}

/** Format follower count for display */
function formatFollowers(n: number | null): string {
  if (n === null || n === 0) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

const QUICK_OUTCOMES: { outcome: Outcome; label: string; color: string }[] = [
  {
    outcome: "connected",
    label: "Connected",
    color: "bg-emerald-600 hover:bg-emerald-500",
  },
  {
    outcome: "voicemail",
    label: "Voicemail",
    color: "bg-amber-600 hover:bg-amber-500",
  },
  {
    outcome: "no_answer",
    label: "No Answer",
    color: "bg-slate-600 hover:bg-slate-500",
  },
  {
    outcome: "not_interested",
    label: "Not Interested",
    color: "bg-red-600 hover:bg-red-500",
  },
];

// ============================================================
// Component
// ============================================================

interface SessionLeadCardProps {
  lead: Lead;
  userId: string;
  sessionId: string;
  scriptContent: string | null;
  onOutcome: (outcome: Outcome, note: string | null) => void;
  onSkip: () => void;
}

export default function SessionLeadCard({
  lead,
  userId,
  sessionId,
  scriptContent,
  onOutcome,
  onSkip,
}: SessionLeadCardProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const warnings = checkMissingData(lead);
  const briefing = lead.ai_briefing;

  async function handleLog() {
    if (!selectedOutcome) return;
    setSubmitting(true);
    onOutcome(selectedOutcome, note.trim() || null);
  }

  return (
    <div className="space-y-3">
      {/* ============ LEAD HEADER CARD ============ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        {/* Business name + badges row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-white">{lead.name}</h2>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
              {lead.is_hot && (
                <span className="rounded bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {"\uD83D\uDD25"} Hot
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
          </div>

          {/* Script toggle button */}
          {scriptContent && (
            <button
              onClick={() => setShowScript(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white"
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
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              Script
            </button>
          )}
        </div>

        {/* Category + Address */}
        {(lead.category || lead.city || lead.address) && (
          <p className="mt-2 text-sm text-slate-400">
            {[lead.category, lead.address, lead.city]
              .filter(Boolean)
              .join(" \u2022 ")}
          </p>
        )}

        {/* ---- OWNER (prominent) ---- */}
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

        {/* ---- CONTACT INFO (prominent) ---- */}
        <div className="mt-3 flex flex-wrap gap-3">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-slate-700 hover:text-blue-300"
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
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              {lead.phone}
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-slate-700 hover:text-blue-300"
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
              className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-slate-700 hover:text-blue-300"
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
                  d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582"
                />
              </svg>
              Website
            </a>
          )}
        </div>

        {/* ---- SOCIAL LINKS (clickable) ---- */}
        {(lead.instagram || lead.tiktok || lead.facebook) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {lead.instagram && (
              <a
                href={buildSocialUrl("instagram", lead.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-pink-700/50 bg-pink-900/20 px-3 py-1.5 text-sm font-medium text-pink-400 transition hover:bg-pink-900/40"
              >
                IG: {lead.instagram}
                {lead.instagram_followers ? (
                  <span className="ml-1 text-xs text-pink-500">
                    ({formatFollowers(lead.instagram_followers)})
                  </span>
                ) : null}
              </a>
            )}
            {lead.facebook && (
              <a
                href={buildSocialUrl("facebook", lead.facebook)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-blue-700/50 bg-blue-900/20 px-3 py-1.5 text-sm font-medium text-blue-300 transition hover:bg-blue-900/40"
              >
                FB: {lead.facebook.length > 30 ? "Facebook" : lead.facebook}
                {lead.facebook_followers ? (
                  <span className="ml-1 text-xs text-blue-500">
                    ({formatFollowers(lead.facebook_followers)})
                  </span>
                ) : null}
              </a>
            )}
            {lead.tiktok && (
              <a
                href={buildSocialUrl("tiktok", lead.tiktok)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-slate-600/50 bg-slate-700/20 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700/40"
              >
                TT: {lead.tiktok}
                {lead.tiktok_followers ? (
                  <span className="ml-1 text-xs text-slate-500">
                    ({formatFollowers(lead.tiktok_followers)})
                  </span>
                ) : null}
              </a>
            )}
          </div>
        )}
      </div>

      {/* ============ MISSING DATA ============ */}
      <SessionMissingData warnings={warnings} />

      {/* ============ AI BRIEFING (collapsible) ============ */}
      {briefing && (
        <div className="rounded-lg border border-slate-700 bg-slate-800">
          <button
            onClick={() => setShowBriefing(!showBriefing)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <h3 className="text-sm font-semibold text-slate-300">
              AI Briefing
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
                <p className="text-sm text-slate-400">{briefing.summary}</p>
              )}

              {briefing.recommended_channel && (
                <div className="text-sm">
                  <span className="font-medium text-blue-400">
                    Recommended: {briefing.recommended_channel}
                  </span>
                  {briefing.channel_reasoning && (
                    <span className="text-slate-500">
                      {" "}
                      &mdash; {briefing.channel_reasoning}
                    </span>
                  )}
                </div>
              )}

              {briefing.talking_points && briefing.talking_points.length > 0 && (
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

              {briefing.objections && briefing.objections.length > 0 && (
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

      {/* ============ NOTES ============ */}
      <SessionNotes leadId={lead.id} userId={userId} />

      {/* ============ LOG OUTCOME ============ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Log Outcome</h3>

        <div className="grid grid-cols-2 gap-2">
          {QUICK_OUTCOMES.map((qo) => (
            <button
              key={qo.outcome}
              onClick={() => setSelectedOutcome(qo.outcome)}
              className={`rounded-lg py-2.5 text-sm font-semibold text-white transition ${
                qo.color
              } ${
                selectedOutcome === qo.outcome
                  ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                  : ""
              }`}
            >
              {qo.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note..."
          className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-600"
          >
            Skip
          </button>
          <button
            onClick={handleLog}
            disabled={!selectedOutcome || submitting}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? "Logging..." : "Log \u2192"}
          </button>
        </div>
      </div>

      {/* ============ SCRIPT SLIDE-OVER ============ */}
      <SessionScriptDisplay
        scriptContent={scriptContent}
        lead={lead}
        open={showScript}
        onClose={() => setShowScript(false)}
      />
    </div>
  );
}
