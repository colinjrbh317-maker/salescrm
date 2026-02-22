"use client";

import Link from "next/link";
import type { SessionType, Goals } from "@/lib/types";
import { OUTCOME_LABELS } from "@/lib/types";

interface SessionSummaryProps {
  sessionType: SessionType;
  startedAt: string;
  leadsWorked: number;
  leadsSkipped: number;
  totalLeads: number;
  outcomes: Record<string, number>;
  bestStreak: number;
  goals: Goals | null;
}

export default function SessionSummary({
  sessionType,
  startedAt,
  leadsWorked,
  leadsSkipped,
  totalLeads,
  outcomes,
  bestStreak,
  goals,
}: SessionSummaryProps) {
  const elapsed = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000
  );
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  const goalHit = goals
    ? (sessionType === "call" && leadsWorked >= goals.calls_per_day) ||
      (sessionType === "email" && leadsWorked >= goals.emails_per_day) ||
      (sessionType === "dm" && leadsWorked >= goals.dms_per_day)
    : false;

  const celebratory = bestStreak > 5 || goalHit;

  const goalTarget = goals
    ? sessionType === "call"
      ? goals.calls_per_day
      : sessionType === "email"
      ? goals.emails_per_day
      : sessionType === "dm"
      ? goals.dms_per_day
      : goals.calls_per_day + goals.emails_per_day + goals.dms_per_day
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        {celebratory && (
          <p className="text-4xl mb-2">{"\uD83C\uDF89"}</p>
        )}
        <h1 className="text-2xl font-bold text-white">Session Complete</h1>
        <p className="mt-1 text-sm text-slate-400">
          {mins}m {secs}s elapsed
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-white">{leadsWorked}</p>
          <p className="text-xs text-slate-400">Worked</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-white">{leadsSkipped}</p>
          <p className="text-xs text-slate-400">Skipped</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">
            {bestStreak > 0 ? `${bestStreak}x` : "-"}
          </p>
          <p className="text-xs text-slate-400">Best Streak</p>
        </div>
      </div>

      {/* Outcomes breakdown */}
      {Object.keys(outcomes).length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            Outcomes
          </h3>
          <div className="space-y-2">
            {Object.entries(outcomes)
              .sort(([, a], [, b]) => b - a)
              .map(([key, count]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    {OUTCOME_LABELS[key as keyof typeof OUTCOME_LABELS] ?? key}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{
                          width: `${Math.round(
                            (count / leadsWorked) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-white w-6 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Goal progress */}
      {goals && goalTarget && goalTarget > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            Daily Goal Progress
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>
                  {sessionType === "call"
                    ? "Calls"
                    : sessionType === "email"
                    ? "Emails"
                    : sessionType === "dm"
                    ? "DMs"
                    : "Activities"}
                </span>
                <span>
                  {leadsWorked} / {goalTarget}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-700">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    goalHit ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((leadsWorked / goalTarget) * 100)
                    )}%`,
                  }}
                />
              </div>
              {goalHit && (
                <p className="mt-1 text-xs text-emerald-400 font-medium">
                  Goal reached!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Return button */}
      <Link
        href="/"
        className="block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
