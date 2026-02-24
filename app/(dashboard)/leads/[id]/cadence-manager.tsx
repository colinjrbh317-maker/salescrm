"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Cadence, ActivityType } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";

// ============================================================
// Cadence Templates
// ============================================================

interface CadenceStep {
  dayOffset: number;
  activityType: ActivityType;
}

interface CadenceTemplate {
  name: string;
  description: string;
  steps: CadenceStep[];
}

const CADENCE_TEMPLATES: CadenceTemplate[] = [
  {
    name: "Standard Outreach",
    description: "Balanced 7-step sequence across all channels over 21 days",
    steps: [
      { dayOffset: 0, activityType: "cold_call" },
      { dayOffset: 1, activityType: "cold_email" },
      { dayOffset: 3, activityType: "social_dm" },
      { dayOffset: 5, activityType: "follow_up_call" },
      { dayOffset: 7, activityType: "follow_up_email" },
      { dayOffset: 14, activityType: "follow_up_call" },
      { dayOffset: 21, activityType: "walk_in" },
    ],
  },
  {
    name: "Digital First",
    description: "Email and social-heavy 5-step sequence over 14 days",
    steps: [
      { dayOffset: 0, activityType: "cold_email" },
      { dayOffset: 2, activityType: "social_dm" },
      { dayOffset: 4, activityType: "social_dm" },
      { dayOffset: 7, activityType: "follow_up_email" },
      { dayOffset: 14, activityType: "cold_call" },
    ],
  },
  {
    name: "In-Person Priority",
    description: "Walk-in and call-heavy 5-step sequence over 14 days",
    steps: [
      { dayOffset: 0, activityType: "walk_in" },
      { dayOffset: 2, activityType: "cold_call" },
      { dayOffset: 5, activityType: "follow_up_call" },
      { dayOffset: 10, activityType: "cold_email" },
      { dayOffset: 14, activityType: "walk_in" },
    ],
  },
];

// ============================================================
// Helper: map ActivityType to a display-friendly channel label
// ============================================================

const ACTIVITY_TYPE_ICON_COLORS: Record<string, string> = {
  cold_call: "bg-blue-900/50 text-blue-400 border-blue-700",
  cold_email: "bg-purple-900/50 text-purple-400 border-purple-700",
  social_dm: "bg-pink-900/50 text-pink-400 border-pink-700",
  follow_up_call: "bg-cyan-900/50 text-cyan-400 border-cyan-700",
  follow_up_email: "bg-indigo-900/50 text-indigo-400 border-indigo-700",
  walk_in: "bg-amber-900/50 text-amber-400 border-amber-700",
  meeting: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
};

function getStepColor(activityType: string): string {
  return (
    ACTIVITY_TYPE_ICON_COLORS[activityType] ??
    "bg-slate-700 text-slate-300 border-slate-600"
  );
}

// ============================================================
// Component Props
// ============================================================

interface CadenceManagerProps {
  leadId: string;
  currentUserId: string;
  cadences: Cadence[];
}

export function CadenceManager({
  leadId,
  currentUserId,
  cadences,
}: CadenceManagerProps) {
  const [starting, setStarting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const hasActiveCadence = cadences.length > 0;

  // ----------------------------------------------------------
  // Start a cadence from a template
  // ----------------------------------------------------------

  async function startCadence(template: CadenceTemplate) {
    setStarting(true);

    const now = new Date();
    const rows = template.steps.map((step, index) => {
      const scheduledDate = new Date(now);
      scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);

      return {
        lead_id: leadId,
        user_id: currentUserId,
        step_number: index + 1,
        channel: step.activityType,
        scheduled_at: scheduledDate.toISOString(),
        completed_at: null,
        skipped: false,
      };
    });

    const { error: insertError } = await supabase.from("cadences").insert(rows);

    if (insertError) {
      setError("Failed to start cadence — try again");
      setTimeout(() => setError(null), 5000);
    } else {
      router.refresh();
    }

    setStarting(false);
  }

  // ----------------------------------------------------------
  // Mark a step as completed
  // ----------------------------------------------------------

  async function markCompleted(cadenceId: string) {
    setUpdatingId(cadenceId);
    setError(null);

    const { error: updateError } = await supabase
      .from("cadences")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", cadenceId);

    if (updateError) {
      setError("Failed to mark step as done");
      setTimeout(() => setError(null), 5000);
    } else {
      router.refresh();
    }
    setUpdatingId(null);
  }

  // ----------------------------------------------------------
  // Mark a step as skipped
  // ----------------------------------------------------------

  async function markSkipped(cadenceId: string) {
    setUpdatingId(cadenceId);
    setError(null);

    const { error: updateError } = await supabase
      .from("cadences")
      .update({ skipped: true })
      .eq("id", cadenceId);

    if (updateError) {
      setError("Failed to skip step");
      setTimeout(() => setError(null), 5000);
    } else {
      router.refresh();
    }
    setUpdatingId(null);
  }

  // ----------------------------------------------------------
  // Determine step status
  // ----------------------------------------------------------

  function getStepStatus(cadence: Cadence): {
    label: string;
    className: string;
  } {
    if (cadence.completed_at) {
      return {
        label: "Completed",
        className: "bg-emerald-900/50 text-emerald-400",
      };
    }
    if (cadence.skipped) {
      return {
        label: "Skipped",
        className: "bg-slate-700 text-slate-400",
      };
    }
    const now = new Date();
    const scheduled = new Date(cadence.scheduled_at);
    if (scheduled <= now) {
      return {
        label: "Due",
        className: "bg-amber-900/50 text-amber-400",
      };
    }
    return {
      label: "Pending",
      className: "bg-slate-700 text-slate-400",
    };
  }

  // ----------------------------------------------------------
  // Format a date relative to today
  // ----------------------------------------------------------

  function formatScheduledDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    return `In ${diffDays}d`;
  }

  // ==========================================================
  // Render: Template Selector (no active cadence)
  // ==========================================================

  const errorBanner = error ? (
    <div className="mb-3 rounded-md border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
      {error}
    </div>
  ) : null;

  if (!hasActiveCadence) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        {errorBanner}
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Start a Cadence
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Choose a cadence template to begin automated outreach scheduling for
          this lead.
        </p>

        <div className="space-y-3">
          {CADENCE_TEMPLATES.map((template) => (
            <div
              key={template.name}
              className="rounded-lg border border-slate-600 bg-slate-750 p-4 transition-colors hover:border-slate-500"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-white">
                    {template.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {template.description}
                  </p>

                  {/* Step preview pills */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.steps.map((step, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${getStepColor(step.activityType)}`}
                      >
                        D{step.dayOffset}{" "}
                        {ACTIVITY_TYPE_LABELS[step.activityType]}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => startCadence(template)}
                  disabled={starting}
                  className="ml-4 shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starting ? "Starting..." : "Start Cadence"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==========================================================
  // Render: Active Cadence Timeline
  // ==========================================================

  const sortedCadences = [...cadences].sort(
    (a, b) => a.step_number - b.step_number
  );

  const completedCount = cadences.filter((c) => c.completed_at).length;
  const skippedCount = cadences.filter((c) => c.skipped).length;
  const totalSteps = cadences.length;
  const progressPct =
    totalSteps > 0
      ? Math.round(((completedCount + skippedCount) / totalSteps) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      {errorBanner}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Active Cadence
        </h2>
        <span className="text-xs text-slate-400">
          {completedCount}/{totalSteps} completed
          {skippedCount > 0 ? ` | ${skippedCount} skipped` : ""}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-1.5 w-full rounded-full bg-slate-700">
        <div
          className="h-1.5 rounded-full bg-blue-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {sortedCadences.map((cadence, index) => {
          const status = getStepStatus(cadence);
          const isLast = index === sortedCadences.length - 1;
          const isDone = !!cadence.completed_at || cadence.skipped;
          const isUpdating = updatingId === cadence.id;

          return (
            <div key={cadence.id} className="relative flex gap-4 pb-5">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-3.5 top-8 h-full w-px ${
                    isDone ? "bg-slate-600" : "bg-slate-700"
                  }`}
                />
              )}

              {/* Step number circle */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  cadence.completed_at
                    ? "bg-emerald-600 text-white"
                    : cadence.skipped
                      ? "bg-slate-600 text-slate-400 line-through"
                      : status.label === "Due"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-700 text-slate-300"
                }`}
              >
                {cadence.completed_at ? (
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  cadence.step_number
                )}
              </div>

              {/* Step content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${getStepColor(cadence.channel)}`}
                  >
                    {ACTIVITY_TYPE_LABELS[cadence.channel as ActivityType] ??
                      cadence.channel}
                  </span>

                  <span className={`rounded px-1.5 py-0.5 text-xs ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {new Date(cadence.scheduled_at).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  &middot; {formatScheduledDate(cadence.scheduled_at)}
                  {cadence.completed_at && (
                    <>
                      {" "}
                      &middot; Done{" "}
                      {new Date(cadence.completed_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </>
                  )}
                </p>

                {/* Action buttons for pending steps */}
                {!isDone && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => markCompleted(cadence.id)}
                      disabled={isUpdating}
                      className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isUpdating ? "..." : "Mark Done"}
                    </button>
                    <button
                      onClick={() => markSkipped(cadence.id)}
                      disabled={isUpdating}
                      className="rounded bg-slate-600 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-500 disabled:opacity-50"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
