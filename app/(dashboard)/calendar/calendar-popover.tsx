"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ACTIVITY_TYPE_LABELS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
} from "@/lib/types";
import type { ActivityType, PipelineStage, AiBriefing } from "@/lib/types";

// ============================================================
// Types
// ============================================================

interface PopoverLead {
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

interface CadenceForPopover {
  id: string;
  channel: string;
  scheduled_at: string;
  step_number: number;
  leads: PopoverLead;
}

interface CalendarPopoverProps {
  cadence: CadenceForPopover;
  onComplete: (id: string, scheduledAt: string) => void;
  onReschedule: (id: string, newDate: string, scheduledAt: string) => void;
  onClose: () => void;
  anchorRect?: { top: number; left: number; width: number; height: number };
}

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
// Component
// ============================================================

export function CalendarPopover({
  cadence,
  onComplete,
  onReschedule,
  onClose,
}: CalendarPopoverProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const lead = cadence.leads;
  const pipelineStage = lead.pipeline_stage as PipelineStage;
  const stageLabel =
    PIPELINE_STAGE_LABELS[pipelineStage] ?? lead.pipeline_stage;
  const stageColor =
    PIPELINE_STAGE_COLORS[pipelineStage] ?? "bg-slate-600 text-slate-200";
  const activityLabel =
    ACTIVITY_TYPE_LABELS[cadence.channel as ActivityType] ?? cadence.channel;

  // First talking point from AI briefing
  const firstTalkingPoint =
    lead.ai_briefing?.talking_points?.[0] ?? null;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const quickPicks = getQuickPickOptions();

  return (
    <div
      ref={popoverRef}
      className="w-[300px] rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-xl"
      style={{
        animation: "popoverIn 150ms ease-out",
      }}
    >
      <style jsx>{`
        @keyframes popoverIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Lead name + website favicon */}
      <div className="flex items-center gap-2">
        {lead.website && (
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
              lead.website.replace(/^https?:\/\//, "")
            )}&sz=32`}
            alt=""
            className="h-5 w-5 shrink-0 rounded"
            loading="lazy"
          />
        )}
        <h3 className="text-base font-semibold text-white truncate">
          {lead.name}
        </h3>
      </div>

      {/* Category + City */}
      {(lead.category || lead.city) && (
        <p className="mt-1 text-xs text-slate-400">
          {lead.category}
          {lead.category && lead.city ? " · " : ""}
          {lead.city}
        </p>
      )}

      {/* Pipeline stage + score */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${stageColor}`}
        >
          {stageLabel}
        </span>
        {lead.composite_score != null && (
          <span className="text-xs text-slate-400">
            Score: {lead.composite_score}
          </span>
        )}
      </div>

      {/* Activity type + step */}
      <div className="mt-2 text-xs text-slate-500">
        {activityLabel} &middot; Step {cadence.step_number}
      </div>

      {/* AI talking point */}
      {firstTalkingPoint && (
        <div className="mt-3 rounded border border-slate-700 bg-slate-900/50 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Talking Point
          </p>
          <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">
            {firstTalkingPoint}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onComplete(cadence.id, cadence.scheduled_at)}
          className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Complete
        </button>
        <button
          onClick={() => setShowReschedule(!showReschedule)}
          className="flex-1 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600"
        >
          Reschedule
        </button>
        <Link
          href={`/leads/${lead.id}`}
          className="flex-1 rounded-md border border-slate-600 px-3 py-1.5 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          Open Lead
        </Link>
      </div>

      {/* Reschedule quick-pick */}
      {showReschedule && (
        <div className="mt-2 rounded-md border border-slate-700 bg-slate-900/50 py-1">
          {quickPicks.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                onReschedule(cadence.id, opt.date, cadence.scheduled_at);
                onClose();
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
