"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import type { ActivityType, AiBriefing } from "@/lib/types";

// ============================================================
// Types
// ============================================================

interface CalendarItemLead {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  website: string | null;
  pipeline_stage: string;
  composite_score: number | null;
  ai_briefing: AiBriefing | null;
  enriched_at: string | null;
}

export interface CalendarItemCadence {
  id: string;
  lead_id: string;
  user_id: string;
  step_number: number;
  channel: string;
  scheduled_at: string;
  completed_at: string | null;
  skipped: boolean;
  script_id: string | null;
  template_name: string | null;
  created_at: string;
  leads: CalendarItemLead;
}

interface CalendarItemProps {
  cadence: CalendarItemCadence;
  compact?: boolean;
  onComplete: (id: string, scheduledAt: string) => void;
  onSkip: (id: string, scheduledAt: string) => void;
  onReschedule: (id: string, newDate: string, scheduledAt: string) => void;
  isCompleting?: boolean;
  isSkipping?: boolean;
  onHover?: (id: string | null) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
}

// ============================================================
// Activity type colors
// ============================================================

const ACTIVITY_TYPE_BORDER_COLORS: Record<string, string> = {
  cold_call: "border-l-blue-500",
  cold_email: "border-l-purple-500",
  social_dm: "border-l-pink-500",
  follow_up_call: "border-l-cyan-500",
  follow_up_email: "border-l-indigo-500",
  walk_in: "border-l-amber-500",
  meeting: "border-l-emerald-500",
};

const ACTIVITY_TYPE_BADGE_COLORS: Record<string, string> = {
  cold_call: "bg-blue-900/50 text-blue-400 border-blue-700",
  cold_email: "bg-purple-900/50 text-purple-400 border-purple-700",
  social_dm: "bg-pink-900/50 text-pink-400 border-pink-700",
  follow_up_call: "bg-cyan-900/50 text-cyan-400 border-cyan-700",
  follow_up_email: "bg-indigo-900/50 text-indigo-400 border-indigo-700",
  walk_in: "bg-amber-900/50 text-amber-400 border-amber-700",
  meeting: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
};

// ============================================================
// Quick-pick reschedule options
// ============================================================

function getQuickPickOptions() {
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const threeDays = new Date(today);
  threeDays.setDate(threeDays.getDate() + 3);
  const nextMonday = new Date(today);
  nextMonday.setDate(
    nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7)
  );
  return [
    { label: "Today", date: today.toISOString() },
    { label: "Tomorrow", date: tomorrow.toISOString() },
    { label: "In 3 days", date: threeDays.toISOString() },
    { label: "Next Monday", date: nextMonday.toISOString() },
  ];
}

// ============================================================
// Time formatting
// ============================================================

function formatTime(scheduledAt: string): string {
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // Overdue: show "N days late"
  if (scheduled < todayStart) {
    const diffMs = todayStart.getTime() - scheduled.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d late`;
  }

  // No specific time (midnight)
  const hours = scheduled.getHours();
  const minutes = scheduled.getMinutes();
  if (hours === 0 && minutes === 0) return "";

  // Format as "9:00 AM"
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  const displayMin = minutes.toString().padStart(2, "0");
  return `${displayHour}:${displayMin} ${period}`;
}

// ============================================================
// Component
// ============================================================

export function CalendarItem({
  cadence,
  compact = false,
  onComplete,
  onSkip,
  onReschedule,
  isCompleting = false,
  isSkipping = false,
  onHover,
  onDragStart,
}: CalendarItemProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [showHoverActions, setShowHoverActions] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rescheduleRef = useRef<HTMLDivElement>(null);

  const borderColor =
    ACTIVITY_TYPE_BORDER_COLORS[cadence.channel] ?? "border-l-slate-500";
  const badgeColor =
    ACTIVITY_TYPE_BADGE_COLORS[cadence.channel] ??
    "bg-slate-700 text-slate-300 border-slate-600";
  const activityLabel =
    ACTIVITY_TYPE_LABELS[cadence.channel as ActivityType] ?? cadence.channel;

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const isOverdue = new Date(cadence.scheduled_at) < todayStart;
  const isDone = !!cadence.completed_at || cadence.skipped;
  const isPending = isCompleting || isSkipping;

  const timeText = formatTime(cadence.scheduled_at);

  const quickPicks = getQuickPickOptions();

  // Close reschedule dropdown on click outside
  useEffect(() => {
    if (!showReschedule) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        rescheduleRef.current &&
        !rescheduleRef.current.contains(e.target as Node)
      ) {
        setShowReschedule(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReschedule]);

  const handleMouseEnter = useCallback(() => {
    onHover?.(cadence.id);
    hoverTimerRef.current = setTimeout(() => {
      setShowHoverActions(true);
    }, 150);
  }, [cadence.id, onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setShowHoverActions(false);
  }, [onHover]);

  // ---- Compact mode (week view) ----
  if (compact) {
    return (
      <div
        className={`group relative flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2 py-1 transition-all hover:border-slate-600 border-l-[3px] ${borderColor} ${isPending ? "opacity-50" : ""} ${isDone ? "opacity-40" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        draggable={!!onDragStart}
        onDragStart={(e) => onDragStart?.(e, cadence.id)}
      >
        {onDragStart && (
          <span className="opacity-0 group-hover:opacity-100 cursor-grab text-slate-600 transition-opacity text-[10px]">
            &#x2807;
          </span>
        )}
        {cadence.leads.website && (
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
              cadence.leads.website.replace(/^https?:\/\//, "")
            )}&sz=16`}
            alt=""
            className="h-3 w-3 shrink-0 rounded"
            loading="lazy"
          />
        )}
        <Link
          href={`/leads/${cadence.leads.id}`}
          className={`text-xs font-medium text-slate-200 hover:text-blue-400 truncate ${isDone ? "line-through" : ""}`}
        >
          {cadence.leads.name}
        </Link>

        {/* Inline compact hover actions */}
        <div
          className={`ml-auto flex items-center gap-0.5 transition-opacity ${showHoverActions && !isDone ? "opacity-100" : "opacity-0"}`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete(cadence.id, cadence.scheduled_at);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400"
            title="Complete"
          >
            <svg
              className="h-3 w-3"
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
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkip(cadence.id, cadence.scheduled_at);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
            title="Skip"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ---- Full mode (day view) ----
  return (
    <div
      className={`group relative rounded-lg border border-slate-700 bg-slate-800 p-3 transition-all hover:border-slate-600 border-l-[3px] ${borderColor} ${isPending ? "opacity-50" : ""} ${isDone ? "opacity-50" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, cadence.id)}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left: drag handle + favicon + lead name + badge */}
        <div className="flex items-center gap-2 min-w-0">
          {onDragStart && (
            <span className="opacity-0 group-hover:opacity-100 cursor-grab text-slate-600 transition-opacity">
              &#x2807;
            </span>
          )}
          {cadence.leads.website && (
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                cadence.leads.website.replace(/^https?:\/\//, "")
              )}&sz=32`}
              alt=""
              className="h-4 w-4 shrink-0 rounded"
              loading="lazy"
            />
          )}
          <Link
            href={`/leads/${cadence.leads.id}`}
            className={`text-sm font-medium text-white hover:text-blue-400 hover:underline truncate ${isDone ? "line-through" : ""}`}
          >
            {cadence.leads.name}
          </Link>
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${badgeColor}`}
          >
            {activityLabel}
          </span>
        </div>

        {/* Right: time + hover action bar */}
        <div className="flex items-center gap-2 shrink-0">
          {timeText && (
            <span
              className={`text-xs ${isOverdue ? "text-red-400 font-medium" : "text-slate-400"}`}
            >
              {timeText}
            </span>
          )}

          {/* Hover action bar */}
          <div
            className={`flex items-center gap-1 transition-opacity ${showHoverActions && !isDone ? "opacity-100" : "opacity-0"}`}
          >
            <button
              onClick={() => onComplete(cadence.id, cadence.scheduled_at)}
              className="rounded p-1 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400"
              title="Complete"
            >
              <svg
                className="h-4 w-4"
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
            </button>
            <button
              onClick={() => setShowReschedule(!showReschedule)}
              className="rounded p-1 text-slate-400 hover:bg-blue-500/20 hover:text-blue-400"
              title="Reschedule"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
            </button>
            <button
              onClick={() => onSkip(cadence.id, cadence.scheduled_at)}
              className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
              title="Skip"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Subtitle: category + city */}
      {(cadence.leads.category || cadence.leads.city) && (
        <p className="mt-1 text-xs text-slate-500 pl-6">
          {cadence.leads.category}
          {cadence.leads.category && cadence.leads.city ? " · " : ""}
          {cadence.leads.city}
        </p>
      )}

      {/* Reschedule quick-pick dropdown */}
      {showReschedule && (
        <div
          ref={rescheduleRef}
          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-xl"
        >
          {quickPicks.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                onReschedule(cadence.id, opt.date, cadence.scheduled_at);
                setShowReschedule(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
