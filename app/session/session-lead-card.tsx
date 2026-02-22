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

const QUICK_OUTCOMES: { outcome: Outcome; label: string; color: string }[] = [
  { outcome: "connected", label: "Connected", color: "bg-emerald-600 hover:bg-emerald-500" },
  { outcome: "voicemail", label: "Voicemail", color: "bg-amber-600 hover:bg-amber-500" },
  { outcome: "no_answer", label: "No Answer", color: "bg-slate-600 hover:bg-slate-500" },
  {
    outcome: "not_interested",
    label: "Not Interested",
    color: "bg-red-600 hover:bg-red-500",
  },
];

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

  const warnings = checkMissingData(lead);
  const briefing = lead.ai_briefing;

  async function handleLog() {
    if (!selectedOutcome) return;
    setSubmitting(true);
    onOutcome(selectedOutcome, note.trim() || null);
  }

  return (
    <div className="space-y-4">
      {/* LEAD INFO */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{lead.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {lead.priority && (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    PRIORITY_COLORS[lead.priority] ?? "bg-slate-600 text-slate-200"
                  }`}
                >
                  {lead.priority}
                </span>
              )}
              {lead.is_hot && (
                <span className="rounded bg-orange-500 px-2 py-0.5 text-xs font-medium text-white">
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
        </div>

        {/* Details */}
        <div className="mt-3 space-y-1 text-sm text-slate-400">
          {(lead.category || lead.city || lead.address) && (
            <p>
              {[lead.category, lead.address, lead.city]
                .filter(Boolean)
                .join(" \u2022 ")}
            </p>
          )}

          <div className="flex flex-wrap gap-3 mt-2">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="text-blue-400 hover:underline"
              >
                {lead.phone}
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="text-blue-400 hover:underline"
              >
                {lead.email}
              </a>
            )}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Website
              </a>
            )}
          </div>

          {/* Social handles */}
          <div className="flex flex-wrap gap-3 mt-1">
            {lead.instagram && (
              <span className="text-pink-400">IG: {lead.instagram}</span>
            )}
            {lead.tiktok && (
              <span className="text-slate-300">TT: {lead.tiktok}</span>
            )}
            {lead.facebook && (
              <span className="text-blue-300">FB: {lead.facebook}</span>
            )}
          </div>

          {/* Owner */}
          {(lead.owner_name || lead.owner_email) && (
            <p className="mt-2 text-xs text-slate-500">
              Owner: {lead.owner_name ?? "Unknown"}
              {lead.owner_email && ` (${lead.owner_email})`}
            </p>
          )}
        </div>
      </div>

      {/* MISSING DATA */}
      <SessionMissingData warnings={warnings} />

      {/* AI BRIEFING */}
      {briefing && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">AI Briefing</h3>

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
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
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
              <p className="text-xs font-medium text-amber-500 uppercase tracking-wider mb-1">
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

      {/* SCRIPT */}
      <SessionScriptDisplay scriptContent={scriptContent} lead={lead} />

      {/* NOTES */}
      <SessionNotes leadId={lead.id} userId={userId} />

      {/* QUICK ACTIONS */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Log Outcome</h3>

        {/* Outcome buttons */}
        <div className="grid grid-cols-2 gap-2">
          {QUICK_OUTCOMES.map((qo) => (
            <button
              key={qo.outcome}
              onClick={() => setSelectedOutcome(qo.outcome)}
              className={`rounded-lg py-3 text-sm font-semibold text-white transition ${
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

        {/* Optional note */}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note..."
          className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />

        {/* Action buttons */}
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
    </div>
  );
}
