"use client";

import { useState, useEffect } from "react";
import type { SessionType } from "@/lib/types";

const TYPE_BADGE_COLORS: Record<SessionType, string> = {
  email: "bg-purple-600 text-purple-100",
  call: "bg-blue-600 text-blue-100",
  dm: "bg-pink-600 text-pink-100",
  mixed: "bg-slate-600 text-slate-100",
};

interface SessionProgressBarProps {
  currentIndex: number;
  totalLeads: number;
  streak: number;
  sessionType: SessionType;
  startedAt: string;
}

export default function SessionProgressBar({
  currentIndex,
  totalLeads,
  streak,
  sessionType,
  startedAt,
}: SessionProgressBarProps) {
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    function tick() {
      const diff = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(diff / 60)
        .toString()
        .padStart(2, "0");
      const secs = (diff % 60).toString().padStart(2, "0");
      setElapsed(`${mins}:${secs}`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const progress =
    totalLeads > 0 ? Math.round((currentIndex / totalLeads) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center justify-between text-sm">
        {/* Leads counter */}
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">
            {currentIndex}/{totalLeads} leads
          </span>

          {/* Dot progress */}
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalLeads, 20) }).map((_, i) => (
              <span
                key={i}
                className={`inline-block h-2 w-2 rounded-full ${
                  i < currentIndex ? "bg-blue-500" : "bg-slate-600"
                }`}
              />
            ))}
            {totalLeads > 20 && (
              <span className="text-xs text-slate-500">
                +{totalLeads - 20}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Streak */}
          {streak > 0 && (
            <span className="flex items-center gap-1 text-orange-400 animate-pulse">
              <span>{"\uD83D\uDD25"}</span>
              <span className="font-bold">{streak}x</span>
            </span>
          )}

          {/* Timer */}
          <span className="font-mono text-slate-400">{elapsed}</span>

          {/* Session type badge */}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_COLORS[sessionType]}`}
          >
            {sessionType}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-700">
        <div
          className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
