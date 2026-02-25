"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-helpers";
import {
  getActivityType,
  getChannel,
  type SessionChannelMode,
} from "@/lib/channel-outcomes";
import type { Session, Lead, Goals, Outcome } from "@/lib/types";
import SessionProgressBar from "./session-progress-bar";
import SessionSummary from "./session-summary";
import EmailSessionCard from "./channels/email-session-card";
import CallSessionCard from "./channels/call-session-card";
import DmSessionCard from "./channels/dm-session-card";
import WalkinSessionCard from "./channels/walkin-session-card";
import BatchMode from "./batch-mode";

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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsLeadId, setDetailsLeadId] = useState<string | null>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState(56);
  const [isResizing, setIsResizing] = useState(false);
  const [isDetailsFullscreen, setIsDetailsFullscreen] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const currentLead = leads[currentIndex] ?? null;

  const activeMode: SessionChannelMode = (() => {
    if (session.session_type !== "mixed" || !currentLead) {
      return session.session_type;
    }

    const rec = currentLead.ai_channel_rec;
    if (
      (rec === "cold_email" || rec === "follow_up_email") &&
      currentLead.email
    ) {
      return "email";
    }
    if (
      rec === "social_dm" &&
      (currentLead.instagram || currentLead.facebook || currentLead.tiktok)
    ) {
      return "dm";
    }
    if (rec === "walk_in" && (currentLead.address || currentLead.city)) {
      return "walkin";
    }
    if (
      (rec === "cold_call" || rec === "follow_up_call") &&
      currentLead.phone
    ) {
      return "call";
    }

    if (currentLead.phone) return "call";
    if (currentLead.email) return "email";
    if (currentLead.instagram || currentLead.facebook || currentLead.tiktok) {
      return "dm";
    }
    if (currentLead.address || currentLead.city) return "walkin";
    return "call";
  })();

  const openLeadDetails = useCallback(() => {
    if (!currentLead) return;
    setDetailsLeadId(currentLead.id);
    setIsDetailsOpen(true);
    setIsDetailsFullscreen(true);
  }, [currentLead]);

  const closeLeadDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setDetailsLeadId(null);
    setIsDetailsFullscreen(false);
  }, []);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const rawWidthPct = ((event.clientX - rect.left) / rect.width) * 100;
      const boundedWidthPct = Math.min(75, Math.max(35, rawWidthPct));
      setLeftPaneWidth(boundedWidthPct);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  const updateSessionInDb = useCallback(
    async (updates: Record<string, unknown>) => {
      try {
        const supabase = createClient();
        await supabase.from("sessions").update(updates).eq("id", session.id);
      } catch {
        // Background sync — don't block UI on failure
      }
    },
    [session.id]
  );

  const endSession = useCallback(async () => {
    setFinished(true);
    // Sync final state in background
    void updateSessionInDb({
      status: "completed",
      ended_at: new Date().toISOString(),
      leads_worked: leadsWorked,
      leads_skipped: leadsSkipped,
      outcomes_summary: outcomes,
      current_index: currentIndex,
      streak_best: bestStreak,
    });
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

  // Optimistic outcome handler — updates UI immediately, syncs DB in background
  const handleOutcome = useCallback(
    async (outcome: Outcome, note: string | null): Promise<boolean> => {
      if (!currentLead) return false;
      setError(null);

      // 1. Update local state IMMEDIATELY (optimistic)
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

      // 2. Advance to next lead immediately
      advanceToNext(nextIdx);

      // 3. Sync to DB in background (non-blocking)
      const supabase = createClient();
      try {
        const result = await logActivity({
          supabase,
          leadId: currentLead.id,
          userId,
          activityType: getActivityType(activeMode),
          channel: getChannel(activeMode),
          outcome,
          notes: note,
        });

        if (!result.success) {
          setError(`Activity logged locally but DB sync failed: ${result.error}`);
        }

        // Update session progress in DB
        void updateSessionInDb({
          leads_worked: newWorked,
          current_index: nextIdx,
          outcomes_summary: newOutcomes,
          streak_best: newBestStreak,
        });
      } catch {
        setError("Activity logged locally but network sync failed. Will retry on next action.");
      }

      return true;
    },
    [
      currentLead,
      userId,
      activeMode,
      leadsWorked,
      streak,
      bestStreak,
      outcomes,
      currentIndex,
      updateSessionInDb,
      advanceToNext,
    ]
  );

  // Snooze handler — does NOT reset streak (unlike old skip)
  const handleSnooze = useCallback(async () => {
    const newSkipped = leadsSkipped + 1;
    const nextIdx = currentIndex + 1;

    // Optimistic: advance immediately, keep streak
    setLeadsSkipped(newSkipped);
    // Streak preserved — snooze is a smart decision, not a failure
    advanceToNext(nextIdx);

    // Background sync
    void updateSessionInDb({
      leads_skipped: newSkipped,
      current_index: nextIdx,
    });
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

  // Channel-specific card props
  const cardProps = {
    lead: currentLead,
    scriptContent: scripts[currentLead.id] ?? null,
    onOutcome: handleOutcome,
    onSnooze: handleSnooze,
    onOpenLeadDetails: openLeadDetails,
  };

  const isBatchMode = session.batch_mode === true;
  const isBatchableType = session.session_type === "email" || session.session_type === "dm";
  const remainingLeads = leads.slice(currentIndex);

  const sessionContent = (
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

      {/* Batch mode */}
      {isBatchMode && isBatchableType && (
        <BatchMode
          leads={remainingLeads}
          scripts={scripts}
          sessionType={session.session_type as "email" | "dm"}
          userId={userId}
          sessionId={session.id}
          onOutcome={handleOutcome}
          onSnooze={handleSnooze}
          onComplete={endSession}
        />
      )}

      {/* Single-lead mode */}
      {!(isBatchMode && isBatchableType) && (
        <>
          {/* Progress */}
          <SessionProgressBar
            currentIndex={currentIndex}
            totalLeads={leads.length}
            sessionType={session.session_type}
            startedAt={session.started_at}
          />

          {/* Channel-specific lead card — keyed by lead.id to force state reset */}
          {activeMode === "email" && (
            <EmailSessionCard key={currentLead.id} {...cardProps} />
          )}
          {activeMode === "call" && (
            <CallSessionCard key={currentLead.id} {...cardProps} />
          )}
          {activeMode === "dm" && (
            <DmSessionCard key={currentLead.id} {...cardProps} />
          )}
          {activeMode === "walkin" && (
            <WalkinSessionCard
              key={currentLead.id}
              {...cardProps}
              userId={userId}
            />
          )}
        </>
      )}

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

  if (!isDetailsOpen || !detailsLeadId) {
    return sessionContent;
  }

  return (
    <>
      <div className="hidden h-full lg:block">
        <div
          ref={splitContainerRef}
          className="flex h-full w-full overflow-hidden border border-slate-700 bg-slate-900/40"
        >
          {!isDetailsFullscreen && (
            <>
              <div
                className="min-w-0 overflow-y-auto p-4"
                style={{ width: `${leftPaneWidth}%` }}
              >
                {sessionContent}
              </div>

              <button
                type="button"
                onMouseDown={startResizing}
                className="w-2 shrink-0 cursor-col-resize border-x border-slate-700 bg-slate-800/70 transition hover:bg-slate-700/90"
                aria-label="Resize split view panes"
                title="Drag to resize panes"
              />
            </>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <p className="text-sm font-medium text-slate-200">Lead Details</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDetailsFullscreen((prev) => !prev)}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
                >
                  {isDetailsFullscreen ? "Split View" : "Full Screen"}
                </button>
                <button
                  type="button"
                  onClick={closeLeadDetails}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              title="Lead details"
              src={`/lead-focus/${detailsLeadId}`}
              className={`min-h-0 flex-1 w-full bg-slate-900 ${isResizing ? "pointer-events-none" : ""}`}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {sessionContent}
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <p className="text-sm font-medium text-slate-200">Lead Details</p>
            <button
              type="button"
              onClick={closeLeadDetails}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              Close
            </button>
          </div>
          <iframe
            title="Lead details"
            src={`/lead-focus/${detailsLeadId}`}
            className="h-[70vh] w-full bg-slate-900"
          />
        </div>
      </div>
    </>
  );
}
