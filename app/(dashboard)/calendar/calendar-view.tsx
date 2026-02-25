"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useCalendarActions } from "./use-calendar-actions";
import { CalendarItem } from "./calendar-item";
import type { CalendarItemCadence } from "./calendar-item";
import { CalendarPopover } from "./calendar-popover";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import type { ActivityType, AiBriefing } from "@/lib/types";

// ============================================================
// Types
// ============================================================

export interface CadenceWithLead {
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
  leads: {
    id: string;
    name: string;
    category: string | null;
    city: string | null;
    website: string | null;
    pipeline_stage: string;
    composite_score: number | null;
    ai_briefing: AiBriefing | null;
    enriched_at: string | null;
  };
}

interface CalendarViewProps {
  cadences: CadenceWithLead[];
  todayTotal: number;
  todayCompleted: number;
}

// ============================================================
// Constants
// ============================================================

type ViewMode = "day" | "week" | "30day";
type FilterTab = "all" | "email" | "call" | "dm" | "walk_in";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "email", label: "Email" },
  { key: "call", label: "Call" },
  { key: "dm", label: "DM" },
  { key: "walk_in", label: "Walk-in" },
];

const FILTER_ACTIVITY_MAP: Record<string, string[]> = {
  email: ["cold_email", "follow_up_email"],
  call: ["cold_call", "follow_up_call"],
  dm: ["social_dm"],
  walk_in: ["walk_in"],
};

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "30day", label: "30 Days" },
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ============================================================
// Date helpers
// ============================================================

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} - ${sunday.toLocaleDateString("en-US", opts)}, ${sunday.getFullYear()}`;
}

function formatMonthRangeLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 29);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}, ${end.getFullYear()}`;
}

// ============================================================
// Dot colors for 30-day mini view
// ============================================================

const CHANNEL_DOT_COLORS: Record<string, string> = {
  cold_call: "bg-blue-500",
  cold_email: "bg-purple-500",
  social_dm: "bg-pink-500",
  follow_up_call: "bg-cyan-500",
  follow_up_email: "bg-indigo-500",
  walk_in: "bg-amber-500",
  meeting: "bg-emerald-500",
};

// ============================================================
// Component
// ============================================================

export function CalendarView({
  cadences,
  todayTotal,
  todayCompleted,
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [overdueCollapsed, setOverdueCollapsed] = useState(false);
  const [popoverCadence, setPopoverCadence] = useState<CadenceWithLead | null>(
    null
  );

  const {
    complete,
    skip,
    reschedule,
    bulkRescheduleToday,
    undo,
    pendingActions,
    undoAction,
  } = useCalendarActions();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // ----------------------------------------------------------
  // Filtered cadences
  // ----------------------------------------------------------
  const filtered = useMemo(() => {
    if (activeFilter === "all") return cadences;
    const allowed = FILTER_ACTIVITY_MAP[activeFilter] ?? [];
    return cadences.filter((c) => allowed.includes(c.channel));
  }, [cadences, activeFilter]);

  // ----------------------------------------------------------
  // Overdue cadences (across all dates)
  // ----------------------------------------------------------
  const overdueCadences = useMemo(() => {
    return filtered.filter((c) => {
      const d = new Date(c.scheduled_at);
      return d < today && !c.completed_at && !c.skipped;
    });
  }, [filtered, today]);

  const overdueIds = useMemo(
    () => overdueCadences.map((c) => c.id),
    [overdueCadences]
  );

  // ----------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------
  const navigate = useCallback(
    (direction: -1 | 0 | 1) => {
      if (direction === 0) {
        setSelectedDate(new Date());
        return;
      }
      setSelectedDate((prev) => {
        const d = new Date(prev);
        if (viewMode === "day") {
          d.setDate(d.getDate() + direction);
        } else if (viewMode === "week") {
          d.setDate(d.getDate() + direction * 7);
        } else {
          d.setDate(d.getDate() + direction * 30);
        }
        return d;
      });
    },
    [viewMode]
  );

  // ----------------------------------------------------------
  // Drag and drop handlers
  // ----------------------------------------------------------
  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      setDraggedItem(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetDate: Date) => {
      e.preventDefault();
      const cadenceId = e.dataTransfer.getData("text/plain");
      if (!cadenceId) return;

      const cadence = cadences.find((c) => c.id === cadenceId);
      if (!cadence) return;

      const newDate = new Date(targetDate);
      newDate.setHours(9, 0, 0, 0);
      reschedule(cadenceId, newDate.toISOString(), cadence.scheduled_at);
      setDraggedItem(null);
    },
    [cadences, reschedule]
  );

  // ----------------------------------------------------------
  // Day view: group by time segment
  // ----------------------------------------------------------
  const dayViewSegments = useMemo(() => {
    if (viewMode !== "day") return null;

    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayCadences = filtered.filter((c) => {
      const d = new Date(c.scheduled_at);
      return d >= dayStart && d < dayEnd;
    });

    const segments: Record<string, CadenceWithLead[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      unscheduled: [],
    };

    for (const c of dayCadences) {
      const d = new Date(c.scheduled_at);
      const h = d.getHours();
      const m = d.getMinutes();

      if (h === 0 && m === 0) {
        segments.unscheduled.push(c);
      } else if (h < 12) {
        segments.morning.push(c);
      } else if (h < 17) {
        segments.afternoon.push(c);
      } else {
        segments.evening.push(c);
      }
    }

    return segments;
  }, [viewMode, selectedDate, filtered]);

  // ----------------------------------------------------------
  // Week view: 7 columns
  // ----------------------------------------------------------
  const weekColumns = useMemo(() => {
    if (viewMode !== "week") return null;

    const monday = getMonday(selectedDate);
    const columns: { date: Date; cadences: CadenceWithLead[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const colDate = new Date(monday);
      colDate.setDate(colDate.getDate() + i);
      colDate.setHours(0, 0, 0, 0);

      const colEnd = new Date(colDate);
      colEnd.setDate(colEnd.getDate() + 1);

      const colCadences = filtered.filter((c) => {
        const d = new Date(c.scheduled_at);
        return d >= colDate && d < colEnd;
      });

      columns.push({ date: colDate, cadences: colCadences });
    }

    return columns;
  }, [viewMode, selectedDate, filtered]);

  // ----------------------------------------------------------
  // 30-day view: grid cells
  // ----------------------------------------------------------
  const monthGrid = useMemo(() => {
    if (viewMode !== "30day") return null;

    // Start 7 days before selectedDate to fill the grid nicely
    const gridStart = new Date(selectedDate);
    gridStart.setDate(gridStart.getDate() - 7);
    gridStart.setHours(0, 0, 0, 0);

    const cells: {
      date: Date;
      cadences: CadenceWithLead[];
      hasOverdue: boolean;
    }[] = [];

    for (let i = 0; i < 35; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(cellDate.getDate() + i);

      const cellEnd = new Date(cellDate);
      cellEnd.setDate(cellEnd.getDate() + 1);

      const cellCadences = filtered.filter((c) => {
        const d = new Date(c.scheduled_at);
        return d >= cellDate && d < cellEnd;
      });

      const hasOverdue =
        cellDate < today &&
        cellCadences.some((c) => !c.completed_at && !c.skipped);

      cells.push({ date: cellDate, cadences: cellCadences, hasOverdue });
    }

    return cells;
  }, [viewMode, selectedDate, filtered, today]);

  // ----------------------------------------------------------
  // Current label for header
  // ----------------------------------------------------------
  const headerLabel = useMemo(() => {
    if (viewMode === "day") return formatDateLabel(selectedDate);
    if (viewMode === "week") return formatWeekLabel(getMonday(selectedDate));
    const gridStart = new Date(selectedDate);
    gridStart.setDate(gridStart.getDate() - 7);
    return formatMonthRangeLabel(gridStart);
  }, [viewMode, selectedDate]);

  // ----------------------------------------------------------
  // Progress percentage
  // ----------------------------------------------------------
  const progressPct =
    todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  // ----------------------------------------------------------
  // Segment labels
  // ----------------------------------------------------------
  const SEGMENT_LABELS: Record<string, string> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    unscheduled: "Unscheduled",
  };

  return (
    <div className="space-y-4">
      {/* ====================================================== */}
      {/* HEADER BAR */}
      {/* ====================================================== */}
      <div className="flex items-center justify-between">
        {/* Left: navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
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
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            onClick={() => navigate(0)}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            Today
          </button>
          <button
            onClick={() => navigate(1)}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
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
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>

        {/* Center: label */}
        <h2 className="text-sm font-semibold text-white">{headerLabel}</h2>

        {/* Right: view mode toggle */}
        <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === tab.key
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================== */}
      {/* CHANNEL FILTER TABS */}
      {/* ====================================================== */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====================================================== */}
      {/* PROGRESS STRIP */}
      {/* ====================================================== */}
      {(viewMode === "day" || viewMode === "week") && todayTotal > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Today: {todayCompleted} of {todayTotal} done
            </span>
            <span className="text-slate-500">{progressPct}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-700">
            <div
              className="h-1 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* OVERDUE SECTION */}
      {/* ====================================================== */}
      {overdueCadences.length > 0 && (viewMode === "day" || viewMode === "week") && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20">
          {/* Overdue header */}
          <button
            onClick={() => setOverdueCollapsed(!overdueCollapsed)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <span className="text-sm font-semibold text-red-400">
                Overdue ({overdueCadences.length})
              </span>
              <svg
                className={`h-4 w-4 text-slate-500 transition-transform ${overdueCollapsed ? "" : "rotate-180"}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                bulkRescheduleToday(overdueIds);
              }}
              className="rounded-md bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30"
            >
              Reschedule All to Today
            </button>
          </button>

          {/* Overdue items */}
          {!overdueCollapsed && (
            <div className="space-y-1 px-4 pb-3">
              {overdueCadences.map((c) => (
                <CalendarItem
                  key={c.id}
                  cadence={c}
                  compact={viewMode === "week"}
                  onComplete={complete}
                  onSkip={skip}
                  onReschedule={reschedule}
                  isCompleting={pendingActions.get(c.id) === "completing"}
                  isSkipping={pendingActions.get(c.id) === "skipping"}
                  onHover={setHoveredItem}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* DAY VIEW */}
      {/* ====================================================== */}
      {viewMode === "day" && dayViewSegments && (
        <div className="space-y-6">
          {(["morning", "afternoon", "evening", "unscheduled"] as const).map(
            (segment) => {
              const items = dayViewSegments[segment];
              if (items.length === 0) return null;
              return (
                <div key={segment}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {SEGMENT_LABELS[segment]}
                  </h3>
                  <div className="space-y-1.5">
                    {items.map((c) => (
                      <CalendarItem
                        key={c.id}
                        cadence={c}
                        onComplete={complete}
                        onSkip={skip}
                        onReschedule={reschedule}
                        isCompleting={
                          pendingActions.get(c.id) === "completing"
                        }
                        isSkipping={pendingActions.get(c.id) === "skipping"}
                        onHover={setHoveredItem}
                      />
                    ))}
                  </div>
                </div>
              );
            }
          )}

          {/* Empty day state */}
          {Object.values(dayViewSegments).every((s) => s.length === 0) && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-12 text-center">
              <p className="text-sm text-slate-400">
                No outreach scheduled for this day.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* WEEK VIEW */}
      {/* ====================================================== */}
      {viewMode === "week" && weekColumns && (
        <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-700 bg-slate-700 overflow-hidden">
          {weekColumns.map((col, i) => {
            const isToday = isSameDay(col.date, today);
            const nonOverdueCadences = col.cadences.filter((c) => {
              const d = new Date(c.scheduled_at);
              return d >= today || !!c.completed_at || c.skipped;
            });

            return (
              <div
                key={i}
                className={`flex flex-col bg-slate-900 min-h-[200px] ${isToday ? "border-t-2 border-emerald-500 bg-emerald-500/5" : ""}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.date)}
              >
                {/* Day header */}
                <button
                  onClick={() => {
                    setSelectedDate(col.date);
                    setViewMode("day");
                  }}
                  className={`flex items-center justify-between px-2 py-2 text-left transition-colors hover:bg-slate-800 ${isToday ? "bg-emerald-500/10" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-medium ${isToday ? "text-emerald-400" : "text-slate-400"}`}
                    >
                      {DAY_NAMES[i]}
                    </span>
                    <span
                      className={`text-sm font-semibold ${isToday ? "text-emerald-300" : "text-white"}`}
                    >
                      {col.date.getDate()}
                    </span>
                  </div>
                  {col.cadences.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isToday ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}
                    >
                      {col.cadences.length}
                    </span>
                  )}
                </button>

                {/* Column items */}
                <div className="flex-1 space-y-1 px-1 pb-1">
                  {nonOverdueCadences.map((c) => (
                    <CalendarItem
                      key={c.id}
                      cadence={c}
                      compact
                      onComplete={complete}
                      onSkip={skip}
                      onReschedule={reschedule}
                      isCompleting={
                        pendingActions.get(c.id) === "completing"
                      }
                      isSkipping={pendingActions.get(c.id) === "skipping"}
                      onHover={setHoveredItem}
                      onDragStart={handleDragStart}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================== */}
      {/* 30-DAY VIEW */}
      {/* ====================================================== */}
      {viewMode === "30day" && monthGrid && (
        <div>
          {/* Day name headers */}
          <div className="grid grid-cols-7 gap-px mb-px">
            {DAY_NAMES.map((name) => (
              <div
                key={name}
                className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500"
              >
                {name}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-700 bg-slate-700 overflow-hidden">
            {monthGrid.map((cell, i) => {
              const isToday = isSameDay(cell.date, today);
              const dots = cell.cadences.slice(0, 3);
              const overflow = cell.cadences.length - 3;

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (cell.cadences.length > 0) {
                      setSelectedDate(cell.date);
                      setViewMode("day");
                    }
                  }}
                  className={`relative flex flex-col items-center gap-1 bg-slate-900 p-2 min-h-[64px] transition-colors hover:bg-slate-800 ${isToday ? "ring-2 ring-inset ring-emerald-500" : ""} ${cell.hasOverdue ? "border-l-2 border-red-500" : ""}`}
                >
                  <span
                    className={`text-xs font-medium ${isToday ? "text-emerald-400" : "text-slate-400"}`}
                  >
                    {cell.date.getDate()}
                  </span>

                  {/* Dots */}
                  {dots.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      {dots.map((c) => (
                        <span
                          key={c.id}
                          className={`h-1.5 w-1.5 rounded-full ${CHANNEL_DOT_COLORS[c.channel] ?? "bg-slate-500"}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Overflow count */}
                  {overflow > 0 && (
                    <span className="text-[9px] text-slate-500">
                      +{overflow}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* POPOVER (for 30-day view click) */}
      {/* ====================================================== */}
      {popoverCadence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <CalendarPopover
            cadence={popoverCadence}
            onComplete={(id, scheduledAt) => {
              complete(id, scheduledAt);
              setPopoverCadence(null);
            }}
            onReschedule={(id, newDate, scheduledAt) => {
              reschedule(id, newDate, scheduledAt);
              setPopoverCadence(null);
            }}
            onClose={() => setPopoverCadence(null)}
          />
        </div>
      )}

      {/* ====================================================== */}
      {/* UNDO TOAST */}
      {/* ====================================================== */}
      {undoAction && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 shadow-xl">
          <span className="text-sm text-slate-200">
            {undoAction.type === "complete" && "Marked complete"}
            {undoAction.type === "skip" && "Skipped"}
            {undoAction.type === "reschedule" && "Rescheduled"}
          </span>
          <button
            onClick={undo}
            className="rounded-md bg-slate-700 px-3 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-slate-600 hover:text-blue-300"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
