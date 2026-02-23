"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ActivityType, Channel, Outcome } from "@/lib/types";
import {
  ACTIVITY_TYPE_LABELS,
  CHANNEL_LABELS,
  OUTCOME_LABELS,
  ACTIVITY_CHANNEL_MAP,
} from "@/lib/types";

const ALL_ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];
const ALL_CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];
const ALL_OUTCOMES = Object.keys(OUTCOME_LABELS) as Outcome[];

interface ActivityLoggerFabProps {
  leadId: string;
  currentUserId: string;
}

export function ActivityLoggerFab({ leadId, currentUserId }: ActivityLoggerFabProps) {
  const [open, setOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("cold_call");
  const [channel, setChannel] = useState<Channel>("phone");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function handleActivityTypeChange(type: ActivityType) {
    setActivityType(type);
    const suggestedChannels = ACTIVITY_CHANNEL_MAP[type];
    if (suggestedChannels && suggestedChannels.length > 0) {
      setChannel(suggestedChannels[0]);
    }
  }

  const suggestedChannels = ACTIVITY_CHANNEL_MAP[activityType] ?? ALL_CHANNELS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);

    const { error } = await supabase.from("activities").insert({
      lead_id: leadId,
      user_id: currentUserId,
      activity_type: activityType,
      channel: channel,
      outcome: outcome || null,
      notes: notes || null,
      is_private: false,
      occurred_at: new Date().toISOString(),
    });

    if (!error) {
      await supabase
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", leadId);

      setSuccess(true);
      setNotes("");
      setOutcome("");
      router.refresh();
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 2000);
    }

    setSubmitting(false);
  }

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-emerald-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Log Activity
      </button>

      {/* Backdrop + Panel */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Slide-up Panel */}
          <div className="absolute bottom-0 right-0 w-full max-w-md rounded-t-lg border border-slate-700 bg-slate-800 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Log Activity
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-900/30 border border-emerald-700/50 px-4 py-3">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className="text-sm text-emerald-300">Activity logged successfully</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      Activity Type
                    </label>
                    <select
                      value={activityType}
                      onChange={(e) => handleActivityTypeChange(e.target.value as ActivityType)}
                      className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {ALL_ACTIVITY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {ACTIVITY_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      Channel
                    </label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as Channel)}
                      className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {suggestedChannels.map((ch) => (
                        <option key={ch} value={ch}>
                          {CHANNEL_LABELS[ch]}
                        </option>
                      ))}
                      {ALL_CHANNELS.filter((ch) => !suggestedChannels.includes(ch)).map((ch) => (
                        <option key={ch} value={ch}>
                          {CHANNEL_LABELS[ch]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      Outcome
                    </label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as Outcome | "")}
                      className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Select outcome...</option>
                      {ALL_OUTCOMES.map((o) => (
                        <option key={o} value={o}>
                          {OUTCOME_LABELS[o]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="What happened? Key takeaways..."
                    className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="mt-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Logging..." : "Log Activity"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
