"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-helpers";
import type {
  Session,
  Lead,
  Goals,
  Outcome,
  SessionType,
  ActivityType,
  Channel,
} from "@/lib/types";
import SessionProgressBar from "./session-progress-bar";
import SessionLeadCard from "./session-lead-card";
import SessionSummary from "./session-summary";

/** Map session types to the activity type used when logging */
const SESSION_ACTIVITY_MAP: Record<SessionType, ActivityType> = {
  call: "cold_call",
  email: "cold_email",
  dm: "social_dm",
  mixed: "cold_call",
};

const SESSION_CHANNEL_MAP: Record<SessionType, Channel> = {
  call: "phone",
  email: "email",
  dm: "instagram",
  mixed: "phone",
};

interface SessionWorkProps {
  session: Session;
  leads: Lead[];
  scripts: Record<string, string>;
  userId: string;
  goals: Goals | null;
}

export default function SessionWork({
  session,
  leads,
  scripts,
  userId,
  goals,
}: SessionWorkProps) {
  const [currentIndex, setCurrentIndex] = useState(session.current_index);
  const [leadsWorked, setLeadsWorked] = useState(session.leads_worked);
  const [leadsSkipped, setLeadsSkipped] = useState(session.leads_skipped);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(session.streak_best);
  const [outcomes, setOutcomes] = useState<Record<string, number>>(
    session.outcomes_summary ?? {}
  );
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLead = leads[currentIndex] ?? null;

  const updateSessionInDb = useCallback(
    async (updates: Record<string, unknown>) => {
      const supabase = createClient();
      await supabase.from("sessions").update(updates).eq("id", session.id);
    },
    [session.id]
  );

  const endSession = useCallback(async () => {
    await updateSessionInDb({
      status: "completed",
      ended_at: new Date().toISOString(),
      leads_worked: leadsWorked,
      leads_skipped: leadsSkipped,
      outcomes_summary: outcomes,
      current_index: currentIndex,
      streak_best: bestStreak,
    });
    setFinished(true);
  }, [
    updateSessionInDb,
    leadsWorked,
    leadsSkipped,
    outcomes,
    currentIndex,
    bestStreak,
  ]);

  const advanceToNext = useCallback(
    (nextIndex: number) => {
      if (nextIndex >= leads.length) {
        endSession();
      } else {
        setCurrentIndex(nextIndex);
      }
    },
    [leads.length, endSession]
  );

  const handleOutcome = useCallback(
    async (outcome: Outcome, note: string | null) => {
      if (!currentLead) return;

      setError(null);
      const supabase = createClient();

      try {
        // Log the activity
        const result = await logActivity({
          supabase,
          leadId: currentLead.id,
          userId,
          activityType: SESSION_ACTIVITY_MAP[session.session_type],
          channel: SESSION_CHANNEL_MAP[session.session_type],
          outcome,
          notes: note,
        });

        if (!result.success) {
          setError(`Failed to log activity: ${result.error}`);
          return;
        }

        // Update local state
        const newWorked = leadsWorked + 1;
        const newStreak = streak + 1;
        const newBestStreak = Math.max(bestStreak, newStreak);
        const newOutcomes = {
          ...outcomes,
          [outcome]: (outcomes[outcome] ?? 0) + 1,
        };
        const nextIdx = currentIndex + 1;

        setLeadsWorked(newWorked);
        setStreak(newStreak);
        setBestStreak(newBestStreak);
        setOutcomes(newOutcomes);

        // Update session in DB
        await updateSessionInDb({
          leads_worked: newWorked,
          current_index: nextIdx,
          outcomes_summary: newOutcomes,
          streak_best: newBestStreak,
        });

        advanceToNext(nextIdx);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong logging the outcome. Try again.");
      }
    },
    [
      currentLead,
      userId,
      session.session_type,
      leadsWorked,
      streak,
      bestStreak,
      outcomes,
      currentIndex,
      updateSessionInDb,
      advanceToNext,
    ]
  );

  const handleSkip = useCallback(async () => {
    const newSkipped = leadsSkipped + 1;
    const nextIdx = currentIndex + 1;

    setLeadsSkipped(newSkipped);
    setStreak(0); // Reset streak on skip

    await updateSessionInDb({
      leads_skipped: newSkipped,
      current_index: nextIdx,
    });

    advanceToNext(nextIdx);
  }, [leadsSkipped, currentIndex, updateSessionInDb, advanceToNext]);

  // Show summary when done
  if (finished || !currentLead) {
    return (
      <SessionSummary
        sessionType={session.session_type}
        startedAt={session.started_at}
        leadsWorked={leadsWorked}
        leadsSkipped={leadsSkipped}
        totalLeads={leads.length}
        outcomes={outcomes}
        bestStreak={bestStreak}
        goals={goals}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-xs text-red-400 underline hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Progress */}
      <SessionProgressBar
        currentIndex={currentIndex}
        totalLeads={leads.length}
        streak={streak}
        sessionType={session.session_type}
        startedAt={session.started_at}
      />

      {/* Lead card */}
      <SessionLeadCard
        lead={currentLead}
        userId={userId}
        sessionId={session.id}
        scriptContent={scripts[currentLead.id] ?? null}
        onOutcome={handleOutcome}
        onSkip={handleSkip}
      />

      {/* End session */}
      <div className="flex justify-center pt-4 pb-8">
        <button
          onClick={endSession}
          className="flex items-center gap-2 rounded-lg border border-red-700/50 bg-red-900/20 px-5 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-900/40 hover:text-red-300"
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
              d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
            />
          </svg>
          End Session
        </button>
      </div>
    </div>
  );
}
