"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import type { CadenceWithLead } from "./cadence-hub";

// ============================================================
// Activity type badge colors (matching cadence-manager.tsx)
// ============================================================

const ACTIVITY_TYPE_BADGE_COLORS: Record<string, string> = {
  cold_call: "bg-blue-900/50 text-blue-400 border-blue-700",
  cold_email: "bg-purple-900/50 text-purple-400 border-purple-700",
  social_dm: "bg-pink-900/50 text-pink-400 border-pink-700",
  follow_up_call: "bg-cyan-900/50 text-cyan-400 border-cyan-700",
  follow_up_email: "bg-indigo-900/50 text-indigo-400 border-indigo-700",
  walk_in: "bg-amber-900/50 text-amber-400 border-amber-700",
  meeting: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
};

const EMAIL_TYPES: string[] = ["cold_email", "follow_up_email"];

// ============================================================
// Date formatting helpers
// ============================================================

function formatRelativeDate(scheduledAt: string): string {
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrow = new Date(todayStart);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  if (scheduled < todayStart) {
    const diffMs = todayStart.getTime() - scheduled.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays > 1 ? "s" : ""} late`;
  }

  if (scheduled < tomorrowStart) {
    const hours = scheduled.getHours();
    const minutes = scheduled.getMinutes();
    if (hours === 0 && minutes === 0) return "Today";
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    const displayMin = minutes.toString().padStart(2, "0");
    return `Today ${displayHour}:${displayMin} ${period}`;
  }

  if (scheduled < dayAfterTomorrow) {
    return "Tomorrow";
  }

  return scheduled.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// Component
// ============================================================

interface CadenceStepCardProps {
  cadence: CadenceWithLead;
  isOwner?: boolean;
}

export function CadenceStepCard({ cadence, isOwner = true }: CadenceStepCardProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const activityType = cadence.channel as ActivityType;
  const badgeColor =
    ACTIVITY_TYPE_BADGE_COLORS[cadence.channel] ??
    "bg-slate-700 text-slate-300 border-slate-600";
  const isEmailType = EMAIL_TYPES.includes(cadence.channel);

  // Check if overdue
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isOverdue = new Date(cadence.scheduled_at) < todayStart;

  async function handleReschedule() {
    if (!rescheduleDate) return;
    setSaving(true);

    const newScheduled = new Date(`${rescheduleDate}T${rescheduleTime}:00`);

    const { error } = await supabase
      .from("cadences")
      .update({ scheduled_at: newScheduled.toISOString() })
      .eq("id", cadence.id);

    if (!error) {
      setShowReschedule(false);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 transition-colors hover:border-slate-600">
      <div className="flex items-start justify-between">
        {/* Left: Lead info + activity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Link
              href={`/leads/${cadence.leads.id}`}
              className="text-sm font-bold text-white hover:text-blue-400 hover:underline"
            >
              {cadence.leads.name}
            </Link>

            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {ACTIVITY_TYPE_LABELS[activityType] ?? cadence.channel}
            </span>
          </div>

          {/* Category + City */}
          {(cadence.leads.category || cadence.leads.city) && (
            <p className="mt-1 text-xs text-slate-500">
              {cadence.leads.category}
              {cadence.leads.category && cadence.leads.city ? " - " : ""}
              {cadence.leads.city}
            </p>
          )}

          {/* Scheduled date */}
          <p
            className={`mt-1.5 text-xs ${isOverdue ? "font-medium text-red-400" : "text-slate-400"}`}
          >
            {formatRelativeDate(cadence.scheduled_at)}
            <span className="ml-1 text-slate-600">
              (Step {cadence.step_number})
            </span>
          </p>

          {/* Email optimal time hint */}
          {isEmailType && (
            <p className="mt-1 text-xs italic text-slate-600">
              Optimal: 7-8am or 5-6pm
            </p>
          )}
        </div>

        {/* Right: Reschedule button (only for owner) */}
        {isOwner && (
          <button
            onClick={() => setShowReschedule(!showReschedule)}
            className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            {showReschedule ? "Cancel" : "Reschedule"}
          </button>
        )}
      </div>

      {/* Inline reschedule form (only for owner) */}
      {isOwner && showReschedule && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-700 pt-3">
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
          />
          <input
            type="time"
            value={rescheduleTime}
            onChange={(e) => setRescheduleTime(e.target.value)}
            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleReschedule}
            disabled={!rescheduleDate || saving}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
