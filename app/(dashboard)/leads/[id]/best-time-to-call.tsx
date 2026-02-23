import {
  classifyBusinessType,
  getWindowSummary,
  scoreCurrentMoment,
  analyzeOutcomePatterns,
  type BusinessType,
} from "@/lib/call-timing";
import type { Activity, Lead } from "@/lib/types";

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurant: "Restaurant / Food Service",
  retail: "Retail / Shopping",
  professional_services: "Professional Services",
  health_wellness: "Health & Wellness",
  home_services: "Home Services",
  automotive: "Automotive",
  creator: "Creator / Influencer",
  general: "General Business",
};

interface BestTimeToCallProps {
  lead: Lead;
  activities: Activity[];
}

export function BestTimeToCall({ lead, activities }: BestTimeToCallProps) {
  const businessType = classifyBusinessType(lead.category);
  const windows = getWindowSummary(businessType);
  const currentTiming = scoreCurrentMoment(lead);
  const learnedPatterns = analyzeOutcomePatterns(activities);

  const TIMING_COLORS = {
    emerald: "border-emerald-700/50 bg-emerald-900/20 text-emerald-400",
    blue: "border-blue-700/50 bg-blue-900/20 text-blue-400",
    amber: "border-amber-700/50 bg-amber-900/20 text-amber-400",
    slate: "border-slate-600/50 bg-slate-700/20 text-slate-400",
  } as const;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Best Time to Call
        </h2>
        {/* Current timing badge */}
        <span
          className={`rounded border px-2.5 py-1 text-xs font-medium ${
            TIMING_COLORS[currentTiming.color]
          }`}
        >
          Right now: {currentTiming.label}
        </span>
      </div>

      {/* Business type classification */}
      <p className="mt-2 text-xs text-slate-500">
        Classified as:{" "}
        <span className="font-medium text-slate-400">
          {BUSINESS_TYPE_LABELS[businessType]}
        </span>
        {lead.category && (
          <span className="text-slate-600"> ({lead.category})</span>
        )}
      </p>

      {/* Optimal windows */}
      <div className="mt-3 space-y-2">
        {windows.map((w, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-750 px-3 py-2"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                w.quality === "best" ? "bg-emerald-400" : "bg-blue-400"
              }`}
            />
            <span className="text-sm font-medium text-white">{w.dayLabel}</span>
            <span className="text-sm text-slate-400">{w.timeRange}</span>
            <span
              className={`ml-auto rounded px-1.5 py-0.5 text-xs ${
                w.quality === "best"
                  ? "bg-emerald-900/30 text-emerald-400"
                  : "bg-blue-900/30 text-blue-400"
              }`}
            >
              {w.quality === "best" ? "Best" : "Good"}
            </span>
          </div>
        ))}
      </div>

      {/* Learned patterns from historical data */}
      {learnedPatterns.length > 0 && (
        <div className="mt-4 border-t border-slate-700 pt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            From Your Call History
          </p>
          <div className="mt-2 space-y-1">
            {learnedPatterns.slice(0, 3).map((slot, i) => {
              const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const period = slot.hour >= 12 ? "pm" : "am";
              const h12 = slot.hour > 12 ? slot.hour - 12 : slot.hour || 12;
              const rate = Math.round(slot.connectRate * 100);

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-slate-400">
                    {dayNames[slot.dayOfWeek]} {h12}{period}
                  </span>
                  <span className="text-emerald-400 font-medium">
                    {rate}% connect rate
                  </span>
                  <span className="text-slate-600">
                    ({slot.connects}/{slot.totalCalls} calls)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
