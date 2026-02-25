"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-helpers";
import {
  getActivityType,
  getChannel,
  type SessionChannelMode,
} from "@/lib/channel-outcomes";
import type { Lead, Cadence, Outcome } from "@/lib/types";
import { OUTCOME_LABELS } from "@/lib/types";
import EmailSessionCard from "@/app/session/channels/email-session-card";
import CallSessionCard from "@/app/session/channels/call-session-card";
import DmSessionCard from "@/app/session/channels/dm-session-card";
import WalkinSessionCard from "@/app/session/channels/walkin-session-card";

// ============================================================
// Types
// ============================================================

interface LeadOutreachProps {
  lead: Lead;
  currentUserId: string;
  cadences: Cadence[];
}

type OutreachChannel = "email" | "call" | "dm" | "walkin";

interface ChannelOption {
  key: OutreachChannel;
  label: string;
  enabled: boolean;
}

// ============================================================
// Helpers
// ============================================================

/** Determine best channel from ai_channel_rec, mirroring session-work.tsx logic */
function resolveRecommendedChannel(lead: Lead): OutreachChannel {
  const rec = lead.ai_channel_rec;

  if ((rec === "cold_email" || rec === "follow_up_email") && lead.email) {
    return "email";
  }
  if (
    rec === "social_dm" &&
    (lead.instagram || lead.facebook || lead.tiktok)
  ) {
    return "dm";
  }
  if (rec === "walk_in" && (lead.address || lead.city)) {
    return "walkin";
  }
  if ((rec === "cold_call" || rec === "follow_up_call") && lead.phone) {
    return "call";
  }

  // Fallback chain: phone > email > social > address
  if (lead.phone) return "call";
  if (lead.email) return "email";
  if (lead.instagram || lead.facebook || lead.tiktok) return "dm";
  if (lead.address || lead.city) return "walkin";
  return "call";
}

function buildChannelOptions(lead: Lead): ChannelOption[] {
  return [
    { key: "email", label: "Email", enabled: !!lead.email },
    { key: "call", label: "Call", enabled: !!lead.phone },
    {
      key: "dm",
      label: "DM",
      enabled: !!(lead.instagram || lead.facebook || lead.tiktok),
    },
    {
      key: "walkin",
      label: "Walk-in",
      enabled: !!(lead.address || lead.city),
    },
  ];
}

/** Map our outreach channel to the SessionChannelMode used by channel-outcomes */
function toSessionMode(channel: OutreachChannel): SessionChannelMode {
  return channel;
}

// ============================================================
// Component
// ============================================================

export default function LeadOutreach({
  lead,
  currentUserId,
  cadences,
}: LeadOutreachProps) {
  const router = useRouter();

  const recommendedChannel = useMemo(
    () => resolveRecommendedChannel(lead),
    [lead]
  );
  const channelOptions = useMemo(() => buildChannelOptions(lead), [lead]);

  const [selectedChannel, setSelectedChannel] =
    useState<OutreachChannel>(recommendedChannel);
  const [outcomeLogged, setOutcomeLogged] = useState(false);
  const [loggedOutcome, setLoggedOutcome] = useState<Outcome | null>(null);
  const [snoozed, setSnoozed] = useState(false);

  // Find next pending cadence step
  const nextCadenceStep = useMemo(() => {
    return (
      cadences
        .filter((c) => !c.completed_at && !c.skipped)
        .sort(
          (a, b) =>
            new Date(a.scheduled_at).getTime() -
            new Date(b.scheduled_at).getTime()
        )[0] ?? null
    );
  }, [cadences]);

  // Find the cadence step after the current one (for "Next up" display)
  const followingCadenceStep = useMemo(() => {
    if (!nextCadenceStep) return null;
    const pending = cadences
      .filter((c) => !c.completed_at && !c.skipped && c.id !== nextCadenceStep.id)
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime()
      );
    return pending[0] ?? null;
  }, [cadences, nextCadenceStep]);

  // Outcome handler
  const handleOutcome = useCallback(
    async (outcome: Outcome, note: string | null): Promise<boolean> => {
      const supabase = createClient();
      const mode = toSessionMode(selectedChannel);

      const result = await logActivity({
        supabase,
        leadId: lead.id,
        userId: currentUserId,
        activityType: getActivityType(mode),
        channel: getChannel(mode),
        outcome,
        notes: note,
      });

      if (!result.success) {
        return false;
      }

      // Mark cadence step as completed if there is one
      if (nextCadenceStep) {
        await supabase
          .from("cadences")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", nextCadenceStep.id);
      }

      setOutcomeLogged(true);
      setLoggedOutcome(outcome);
      router.refresh();
      return true;
    },
    [selectedChannel, lead.id, currentUserId, nextCadenceStep, router]
  );

  // Snooze handler
  const handleSnooze = useCallback(() => {
    setSnoozed(true);
  }, []);

  // ============================================================
  // Render
  // ============================================================

  // Success banner after outcome logged
  if (outcomeLogged && loggedOutcome) {
    const outcomeLabel = OUTCOME_LABELS[loggedOutcome] ?? loggedOutcome;

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-700 bg-emerald-900/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 shrink-0 text-emerald-400"
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
            <p className="text-sm font-medium text-emerald-300">
              Activity logged &mdash; {outcomeLabel}
            </p>
          </div>
        </div>

        {/* Next up hint */}
        {followingCadenceStep && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-3">
            <p className="text-sm text-slate-400">
              <span className="font-medium text-slate-300">Next up:</span>{" "}
              {followingCadenceStep.channel} in{" "}
              {Math.max(
                0,
                Math.ceil(
                  (new Date(followingCadenceStep.scheduled_at).getTime() -
                    Date.now()) /
                    (1000 * 60 * 60 * 24)
                )
              )}{" "}
              days
            </p>
          </div>
        )}

        <button
          onClick={() => {
            setOutcomeLogged(false);
            setLoggedOutcome(null);
          }}
          className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white"
        >
          Log Another
        </button>
      </div>
    );
  }

  // Snoozed state
  if (snoozed) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-700 bg-amber-900/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 shrink-0 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="text-sm font-medium text-amber-300">
              Outreach snoozed for this lead
            </p>
          </div>
        </div>
        <button
          onClick={() => setSnoozed(false)}
          className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white"
        >
          Resume Outreach
        </button>
      </div>
    );
  }

  // Card props shared across all channel cards
  const cardProps = {
    lead,
    scriptContent: null as string | null,
    onOutcome: handleOutcome,
    onSnooze: handleSnooze,
    onOpenLeadDetails: () => {
      // Already on lead detail page — no-op
    },
  };

  return (
    <div className="space-y-4">
      {/* Channel selector row */}
      <div className="flex items-center gap-2">
        {channelOptions.map((opt) => (
          <button
            key={opt.key}
            disabled={!opt.enabled}
            onClick={() => opt.enabled && setSelectedChannel(opt.key)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
              selectedChannel === opt.key
                ? "bg-slate-700 text-white"
                : opt.enabled
                  ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  : "cursor-not-allowed text-slate-600"
            }`}
          >
            {opt.label}
            {opt.key === recommendedChannel && opt.enabled && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wider text-emerald-500">
                rec
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cadence context */}
      {nextCadenceStep && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5">
          <p className="text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Cadence step {nextCadenceStep.step_number}:
            </span>{" "}
            {nextCadenceStep.channel} &middot; scheduled{" "}
            {new Date(nextCadenceStep.scheduled_at).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" }
            )}
            {nextCadenceStep.script_id && (
              <span className="ml-2 text-slate-500">(script attached)</span>
            )}
          </p>
        </div>
      )}

      {/* Channel-specific session card */}
      {selectedChannel === "email" && (
        <EmailSessionCard key={`email-${lead.id}`} {...cardProps} />
      )}
      {selectedChannel === "call" && (
        <CallSessionCard key={`call-${lead.id}`} {...cardProps} />
      )}
      {selectedChannel === "dm" && (
        <DmSessionCard key={`dm-${lead.id}`} {...cardProps} />
      )}
      {selectedChannel === "walkin" && (
        <WalkinSessionCard
          key={`walkin-${lead.id}`}
          {...cardProps}
          userId={currentUserId}
        />
      )}
    </div>
  );
}
