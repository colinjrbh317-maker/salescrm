"use client";

import { useState } from "react";

interface PracticeStepProps {
  userId: string;
  onComplete: () => void;
}

const FAKE_LEAD = {
  name: "Joe's Pizza Palace",
  category: "Restaurant",
  city: "Blacksburg",
  phone: "(540) 555-0123",
  email: "joe@joespizza.com",
  website: "joespizza.com",
  owner_name: "Joe Smith",
  priority: "HIGH",
  ai_briefing: {
    summary: "Local pizza shop, 15 years. No online ordering.",
    talking_points: [
      "No online ordering on site",
      "Website is 5+ years old",
      "Not mobile-friendly",
    ],
    recommended_channel: "cold_call",
  },
};

const OUTCOMES = [
  { value: "connected", label: "Connected", color: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "voicemail", label: "Voicemail", color: "bg-amber-600 hover:bg-amber-700" },
  { value: "no_answer", label: "No Answer", color: "bg-slate-600 hover:bg-slate-500" },
  { value: "not_interested", label: "Not Interested", color: "bg-red-600 hover:bg-red-700" },
];

export function PracticeStep({ userId, onComplete }: PracticeStepProps) {
  const [outcomeLogged, setOutcomeLogged] = useState(false);
  const [launching, setLaunching] = useState(false);

  function logOutcome() {
    // Fake -- does NOT write to DB
    setOutcomeLogged(true);
  }

  async function handleLaunch() {
    setLaunching(true);
    await onComplete();
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-8">
      <h2 className="mb-2 text-2xl font-bold text-white">Practice Run</h2>
      <p className="mb-6 text-slate-300">
        Try working a lead before jumping into the real thing. This is a sandbox
        -- nothing gets saved to the database.
      </p>

      {/* Lead card */}
      <div className="mb-6 rounded-lg border border-slate-600 bg-slate-700 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{FAKE_LEAD.name}</h3>
            <p className="text-sm text-slate-400">
              {FAKE_LEAD.category} - {FAKE_LEAD.city}
            </p>
          </div>
          <span className="rounded border border-red-700 bg-red-900/50 px-2 py-0.5 text-xs text-red-400">
            {FAKE_LEAD.priority}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-400">Owner: </span>
            <span className="text-white">{FAKE_LEAD.owner_name}</span>
          </div>
          <div>
            <span className="text-slate-400">Phone: </span>
            <span className="text-white">{FAKE_LEAD.phone}</span>
          </div>
          <div>
            <span className="text-slate-400">Email: </span>
            <span className="text-white">{FAKE_LEAD.email}</span>
          </div>
          <div>
            <span className="text-slate-400">Website: </span>
            <span className="text-white">{FAKE_LEAD.website}</span>
          </div>
        </div>

        {/* AI Briefing */}
        <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
          <h4 className="mb-2 text-sm font-semibold text-blue-400">AI Briefing</h4>
          <p className="mb-3 text-sm text-slate-300">{FAKE_LEAD.ai_briefing.summary}</p>

          <h5 className="mb-1.5 text-xs font-medium text-slate-400">Talking Points</h5>
          <ul className="mb-3 space-y-1">
            {FAKE_LEAD.ai_briefing.talking_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                {point}
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-400">
            Recommended:{" "}
            <span className="font-medium text-blue-400">
              {FAKE_LEAD.ai_briefing.recommended_channel === "cold_call"
                ? "Cold Call"
                : FAKE_LEAD.ai_briefing.recommended_channel}
            </span>
          </p>
        </div>
      </div>

      {/* Outcome buttons OR success message */}
      {!outcomeLogged ? (
        <div>
          <h4 className="mb-3 text-sm font-medium text-slate-400">
            Log a call outcome (sandbox mode):
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome.value}
                onClick={logOutcome}
                className={`rounded-md px-4 py-3 text-sm font-medium text-white transition-colors ${outcome.color}`}
              >
                {outcome.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="mb-4 rounded-lg border border-emerald-700 bg-emerald-900/30 p-6">
            <p className="mb-2 text-lg font-semibold text-emerald-400">
              Great job! You logged an outcome.
            </p>
            <p className="text-sm text-slate-300">
              In a real session, this would update the lead, log an activity,
              and advance the cadence. You are ready for the real thing!
            </p>
          </div>

          <button
            onClick={handleLaunch}
            disabled={launching}
            className="w-full rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launching ? "Launching..." : "Launch First Session"}
          </button>
        </div>
      )}
    </div>
  );
}
