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

interface ActivityLoggerProps {
  leadId: string;
  currentUserId: string;
}

export function ActivityLogger({ leadId, currentUserId }: ActivityLoggerProps) {
  const [activityType, setActivityType] = useState<ActivityType>("cold_call");
  const [channel, setChannel] = useState<Channel>("phone");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Auto-populate channel when activity type changes
  function handleActivityTypeChange(type: ActivityType) {
    setActivityType(type);
    const suggestedChannels = ACTIVITY_CHANNEL_MAP[type];
    if (suggestedChannels && suggestedChannels.length > 0) {
      setChannel(suggestedChannels[0]);
    }
  }

  // Get suggested channels for current activity type
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
      // Also update last_contacted_at on the lead
      await supabase
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", leadId);

      setSuccess(true);
      setNotes("");
      setOutcome("");
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    }

    setSubmitting(false);
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Log Activity
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Activity Type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Activity Type
            </label>
            <select
              value={activityType}
              onChange={(e) =>
                handleActivityTypeChange(e.target.value as ActivityType)
              }
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ALL_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACTIVITY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {/* Show suggested channels first, then all */}
              {suggestedChannels.map((ch) => (
                <option key={ch} value={ch}>
                  {CHANNEL_LABELS[ch]}
                </option>
              ))}
              {ALL_CHANNELS.filter(
                (ch) => !suggestedChannels.includes(ch)
              ).map((ch) => (
                <option key={ch} value={ch}>
                  {CHANNEL_LABELS[ch]}
                </option>
              ))}
            </select>
          </div>

          {/* Outcome */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as Outcome | "")}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

        {/* Notes */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What happened? Key takeaways..."
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Submit */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Logging..." : "Log Activity"}
          </button>
          {success && (
            <span className="text-sm text-emerald-400">
              Activity logged successfully
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
