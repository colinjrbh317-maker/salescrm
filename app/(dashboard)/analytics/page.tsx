import { createClient } from "@/lib/supabase/server";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  ACTIVITY_TYPE_LABELS,
  type PipelineStage,
  type ActivityType,
} from "@/lib/types";

// ============================================================
// Helper: compute days between two ISO date strings
// ============================================================

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // Fetch current user + role (for admin-only sections)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { data: currentProfile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).single()
    : { data: null };

  const isAdmin = currentProfile?.role === "admin";

  // ----------------------------------------------------------
  // 1. Fetch all leads for pipeline data
  // ----------------------------------------------------------

  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, name, pipeline_stage, composite_score, close_amount, created_at, updated_at, assigned_to"
    );

  // Fetch profiles for assignment distribution
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name");

  const stageCounts: Record<string, number> = {};
  let totalLeads = 0;
  let totalRevenue = 0;
  let avgScore = 0;
  let scoreCount = 0;

  if (leads) {
    for (const lead of leads) {
      totalLeads++;
      stageCounts[lead.pipeline_stage] =
        (stageCounts[lead.pipeline_stage] || 0) + 1;
      if (lead.close_amount) totalRevenue += lead.close_amount;
      if (lead.composite_score != null) {
        avgScore += lead.composite_score;
        scoreCount++;
      }
    }
  }

  const avgComposite = scoreCount > 0 ? Math.round(avgScore / scoreCount) : 0;

  // ----------------------------------------------------------
  // 2. Fetch activities for the last 14 days (this week + last week)
  // ----------------------------------------------------------

  const now = new Date();
  const twoWeeksAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();
  const oneWeekAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: recentActivities } = await supabase
    .from("activities")
    .select("id, user_id, activity_type, channel, occurred_at")
    .gte("occurred_at", twoWeeksAgo)
    .order("occurred_at", { ascending: false });

  // Split into this-week vs last-week
  const thisWeekActivities = (recentActivities ?? []).filter(
    (a) => a.occurred_at >= oneWeekAgo
  );
  const lastWeekActivities = (recentActivities ?? []).filter(
    (a) => a.occurred_at < oneWeekAgo
  );

  // ----------------------------------------------------------
  // 3. Activity breakdown by activity_type (channel in context)
  // ----------------------------------------------------------

  const activityTypeCounts: Record<string, number> = {};
  for (const a of thisWeekActivities) {
    activityTypeCounts[a.activity_type] =
      (activityTypeCounts[a.activity_type] || 0) + 1;
  }

  const lastWeekTypeCounts: Record<string, number> = {};
  for (const a of lastWeekActivities) {
    lastWeekTypeCounts[a.activity_type] =
      (lastWeekTypeCounts[a.activity_type] || 0) + 1;
  }

  const maxActivityCount = Math.max(
    ...Object.values(activityTypeCounts),
    1
  );

  // ----------------------------------------------------------
  // 4. Pipeline conversion funnel
  // ----------------------------------------------------------

  // Order stages as a funnel: cold -> contacted -> warm -> proposal -> negotiation -> closed_won
  const funnelStages: PipelineStage[] = [
    "cold",
    "contacted",
    "warm",
    "proposal",
    "negotiation",
    "closed_won",
  ];

  // Count leads that have reached at least this stage
  // A lead in "warm" has passed through "cold" and "contacted"
  const stageOrder: Record<PipelineStage, number> = {
    cold: 0,
    contacted: 1,
    warm: 2,
    proposal: 3,
    negotiation: 4,
    closed_won: 5,
    closed_lost: -1,
    dead: -1,
  };

  // For funnel: count leads at-or-past each stage
  const funnelCounts: Record<string, number> = {};
  for (const stage of funnelStages) {
    funnelCounts[stage] = 0;
  }
  if (leads) {
    for (const lead of leads) {
      const leadOrder = stageOrder[lead.pipeline_stage as PipelineStage];
      if (leadOrder === undefined || leadOrder < 0) continue;
      for (const stage of funnelStages) {
        if (stageOrder[stage] <= leadOrder) {
          funnelCounts[stage]++;
        }
      }
    }
  }

  const maxFunnelCount = Math.max(...Object.values(funnelCounts), 1);

  // ----------------------------------------------------------
  // 5. Time-in-stage average (using pipeline_history)
  // ----------------------------------------------------------

  const { data: pipelineHistory } = await supabase
    .from("pipeline_history")
    .select("lead_id, from_stage, to_stage, created_at")
    .order("created_at", { ascending: true });

  const stageTimeAccumulator: Record<string, { total: number; count: number }> =
    {};

  if (pipelineHistory && pipelineHistory.length > 0) {
    // Group by lead_id, then compute time between transitions
    const byLead: Record<string, typeof pipelineHistory> = {};
    for (const entry of pipelineHistory) {
      if (!byLead[entry.lead_id]) byLead[entry.lead_id] = [];
      byLead[entry.lead_id].push(entry);
    }

    for (const entries of Object.values(byLead)) {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const fromStage = entry.from_stage;
        const days =
          i > 0
            ? daysBetween(entries[i - 1].created_at, entry.created_at)
            : 0;

        if (days > 0) {
          if (!stageTimeAccumulator[fromStage]) {
            stageTimeAccumulator[fromStage] = { total: 0, count: 0 };
          }
          stageTimeAccumulator[fromStage].total += days;
          stageTimeAccumulator[fromStage].count++;
        }
      }
    }
  }

  // ----------------------------------------------------------
  // 6. This week vs last week comparison
  // ----------------------------------------------------------

  const thisWeekCount = thisWeekActivities.length;
  const lastWeekCount = lastWeekActivities.length;
  const weekDelta =
    lastWeekCount > 0
      ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      : thisWeekCount > 0
        ? 100
        : 0;

  // Count unique leads contacted this week vs last
  const thisWeekLeads = new Set(thisWeekActivities.map((a) => a.activity_type));
  const lastWeekLeads = new Set(lastWeekActivities.map((a) => a.activity_type));

  // Calls this week vs last week
  const thisWeekCalls = thisWeekActivities.filter(
    (a) =>
      a.activity_type === "cold_call" || a.activity_type === "follow_up_call"
  ).length;
  const lastWeekCalls = lastWeekActivities.filter(
    (a) =>
      a.activity_type === "cold_call" || a.activity_type === "follow_up_call"
  ).length;

  // Emails this week vs last
  const thisWeekEmails = thisWeekActivities.filter(
    (a) =>
      a.activity_type === "cold_email" || a.activity_type === "follow_up_email"
  ).length;
  const lastWeekEmails = lastWeekActivities.filter(
    (a) =>
      a.activity_type === "cold_email" || a.activity_type === "follow_up_email"
  ).length;

  // ----------------------------------------------------------
  // 7. Team Activity Feed (admin-only — shows all activities)
  // ----------------------------------------------------------

  const teamActivities = isAdmin
    ? (await supabase
        .from("activities")
        .select("id, user_id, lead_id, activity_type, channel, outcome, notes, occurred_at, is_private")
        .order("occurred_at", { ascending: false })
        .limit(100)).data
    : null;

  // Build lookup maps
  const leadNameMap: Record<string, string> = {};
  if (leads) {
    for (const lead of leads) {
      leadNameMap[lead.id] = lead.name;
    }
  }

  // ----------------------------------------------------------
  // 8. Assignment distribution
  // ----------------------------------------------------------

  const profileMap: Record<string, string> = {};
  if (profiles) {
    for (const p of profiles) {
      profileMap[p.id] = p.full_name ?? "Unknown";
    }
  }

  const assignmentCounts: Record<string, number> = {};
  let unassignedCount = 0;
  if (leads) {
    for (const lead of leads) {
      if (lead.assigned_to) {
        const name = profileMap[lead.assigned_to] ?? "Unknown";
        assignmentCounts[name] = (assignmentCounts[name] || 0) + 1;
      } else {
        unassignedCount++;
      }
    }
  }

  const maxAssignmentCount = Math.max(
    ...Object.values(assignmentCounts),
    unassignedCount,
    1
  );

  // ==========================================================
  // Render helpers
  // ==========================================================

  function deltaIndicator(current: number, previous: number): string {
    if (previous === 0 && current === 0) return "-- ";
    if (previous === 0) return "+100%";
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct > 0) return `+${pct}%`;
    if (pct < 0) return `${pct}%`;
    return "0%";
  }

  function deltaColor(current: number, previous: number): string {
    if (current > previous) return "text-emerald-400";
    if (current < previous) return "text-red-400";
    return "text-slate-400";
  }

  // Activity type color mapping for bars
  const activityBarColors: Record<string, string> = {
    cold_call: "bg-blue-500",
    cold_email: "bg-purple-500",
    social_dm: "bg-pink-500",
    follow_up_call: "bg-cyan-500",
    follow_up_email: "bg-indigo-500",
    walk_in: "bg-amber-500",
    meeting: "bg-emerald-500",
    proposal_sent: "bg-orange-500",
    note: "bg-slate-500",
    stage_change: "bg-slate-600",
  };

  // Funnel stage colors
  const funnelColors: Record<string, string> = {
    cold: "bg-slate-500",
    contacted: "bg-blue-500",
    warm: "bg-amber-500",
    proposal: "bg-purple-500",
    negotiation: "bg-orange-500",
    closed_won: "bg-emerald-500",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pipeline and activity metrics
        </p>
      </div>

      {/* ====================================================== */}
      {/* Your Performance (personal metrics) */}
      {/* ====================================================== */}

      {(() => {
        const myActivitiesThisWeek = thisWeekActivities.filter(
          (a) => (a as { user_id?: string }).user_id === userId
        ).length;
        const myActivitiesLastWeek = lastWeekActivities.filter(
          (a) => (a as { user_id?: string }).user_id === userId
        ).length;
        const myLeads = leads?.filter((l) => l.assigned_to === userId) ?? [];
        const myClosedWon = myLeads.filter((l) => l.pipeline_stage === "closed_won").length;
        const myRevenue = myLeads.reduce((sum, l) => sum + (l.close_amount ?? 0), 0);

        return (
          <div className="mb-8 rounded-lg border border-blue-700/30 bg-blue-900/10 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-blue-400">
              Your Performance (7d)
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Activities</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{myActivitiesThisWeek}</span>
                  <span className={`text-xs font-medium ${myActivitiesThisWeek > myActivitiesLastWeek ? "text-emerald-400" : myActivitiesThisWeek < myActivitiesLastWeek ? "text-red-400" : "text-slate-400"}`}>
                    {deltaIndicator(myActivitiesThisWeek, myActivitiesLastWeek)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">My Leads</p>
                <p className="mt-1 text-2xl font-bold text-white">{myLeads.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Closed Won</p>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{myClosedWon}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">My Revenue</p>
                <p className="mt-1 text-2xl font-bold text-emerald-400">${myRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====================================================== */}
      {/* KPI Cards */}
      {/* ====================================================== */}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs font-medium uppercase text-slate-400">
            Total Leads
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{totalLeads}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs font-medium uppercase text-slate-400">
            Closed Revenue
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-400">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs font-medium uppercase text-slate-400">
            Avg Web Score
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{avgComposite}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs font-medium uppercase text-slate-400">
            Activities (7d)
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-blue-400">
              {thisWeekCount}
            </p>
            <span
              className={`text-sm font-medium ${deltaColor(thisWeekCount, lastWeekCount)}`}
            >
              {deltaIndicator(thisWeekCount, lastWeekCount)}
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* Two-column layout: Activity Breakdown + Funnel */}
      {/* ====================================================== */}

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Activity Breakdown by Channel/Type */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Activity Breakdown (7d)
          </h2>
          {Object.keys(activityTypeCounts).length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No activities this week
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(activityTypeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const pct = (count / maxActivityCount) * 100;
                  const label =
                    ACTIVITY_TYPE_LABELS[type as ActivityType] ?? type;
                  const barColor =
                    activityBarColors[type] ?? "bg-slate-500";
                  return (
                    <div key={type}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-300">{label}</span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-700">
                        <div
                          className={`h-2 rounded-full ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Pipeline Conversion Funnel */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Pipeline Conversion Funnel
          </h2>
          <div className="space-y-3">
            {funnelStages.map((stage, index) => {
              const count = funnelCounts[stage] ?? 0;
              const pct =
                maxFunnelCount > 0 ? (count / maxFunnelCount) * 100 : 0;
              const prevCount =
                index > 0
                  ? funnelCounts[funnelStages[index - 1]] ?? 0
                  : 0;
              const conversionPct =
                index > 0 && prevCount > 0
                  ? Math.round((count / prevCount) * 100)
                  : null;
              const barColor = funnelColors[stage] ?? "bg-slate-500";

              return (
                <div key={stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-300">
                      {PIPELINE_STAGE_LABELS[stage]}
                    </span>
                    <span className="flex items-center gap-2 text-slate-400">
                      {conversionPct !== null && (
                        <span className="text-xs text-slate-500">
                          {conversionPct}% conv
                        </span>
                      )}
                      {count}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-700">
                    <div
                      className={`h-2 rounded-full ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* Two-column: Time-in-Stage + Week-over-Week */}
      {/* ====================================================== */}

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Time-in-Stage Average */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Avg Time in Stage (days)
          </h2>
          {Object.keys(stageTimeAccumulator).length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Not enough pipeline history to calculate
            </p>
          ) : (
            <div className="space-y-3">
              {PIPELINE_STAGES.filter(
                (s) =>
                  stageTimeAccumulator[s] &&
                  stageTimeAccumulator[s].count > 0
              ).map((stage) => {
                const data = stageTimeAccumulator[stage];
                const avgDays = Math.round(
                  (data.total / data.count) * 10
                ) / 10;
                const maxDays = Math.max(
                  ...Object.values(stageTimeAccumulator).map((d) =>
                    d.count > 0 ? d.total / d.count : 0
                  ),
                  1
                );
                const pct = (avgDays / maxDays) * 100;

                return (
                  <div key={stage}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-300">
                        {PIPELINE_STAGE_LABELS[stage]}
                      </span>
                      <span className="text-slate-400">
                        {avgDays}d avg
                        <span className="ml-1 text-xs text-slate-500">
                          ({data.count} transitions)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Week-over-Week Comparison */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            This Week vs Last Week
          </h2>
          <div className="space-y-4">
            {/* Total activities */}
            <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-750 p-3">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Total Activities
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white">
                    {thisWeekCount}
                  </span>
                  <span className="text-sm text-slate-500">
                    vs {lastWeekCount}
                  </span>
                </div>
              </div>
              <span
                className={`text-lg font-semibold ${deltaColor(thisWeekCount, lastWeekCount)}`}
              >
                {deltaIndicator(thisWeekCount, lastWeekCount)}
              </span>
            </div>

            {/* Calls */}
            <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-750 p-3">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Calls (Cold + Follow-up)
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white">
                    {thisWeekCalls}
                  </span>
                  <span className="text-sm text-slate-500">
                    vs {lastWeekCalls}
                  </span>
                </div>
              </div>
              <span
                className={`text-lg font-semibold ${deltaColor(thisWeekCalls, lastWeekCalls)}`}
              >
                {deltaIndicator(thisWeekCalls, lastWeekCalls)}
              </span>
            </div>

            {/* Emails */}
            <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-750 p-3">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Emails (Cold + Follow-up)
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white">
                    {thisWeekEmails}
                  </span>
                  <span className="text-sm text-slate-500">
                    vs {lastWeekEmails}
                  </span>
                </div>
              </div>
              <span
                className={`text-lg font-semibold ${deltaColor(thisWeekEmails, lastWeekEmails)}`}
              >
                {deltaIndicator(thisWeekEmails, lastWeekEmails)}
              </span>
            </div>

            {/* Walk-ins + Social */}
            {(() => {
              const thisWeekOther = thisWeekActivities.filter(
                (a) =>
                  a.activity_type === "walk_in" ||
                  a.activity_type === "social_dm"
              ).length;
              const lastWeekOther = lastWeekActivities.filter(
                (a) =>
                  a.activity_type === "walk_in" ||
                  a.activity_type === "social_dm"
              ).length;
              return (
                <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-750 p-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Walk-ins + Social DMs
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xl font-bold text-white">
                        {thisWeekOther}
                      </span>
                      <span className="text-sm text-slate-500">
                        vs {lastWeekOther}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-lg font-semibold ${deltaColor(thisWeekOther, lastWeekOther)}`}
                  >
                    {deltaIndicator(thisWeekOther, lastWeekOther)}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* Assignment Distribution */}
      {/* ====================================================== */}

      <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Lead Assignment Distribution
        </h2>
        {Object.keys(assignmentCounts).length === 0 && unassignedCount === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No leads to display
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(assignmentCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => {
                const pct = (count / maxAssignmentCount) * 100;
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-300">{name}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {unassignedCount > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-400 italic">Unassigned</span>
                  <span className="text-slate-400">{unassignedCount}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-slate-500"
                    style={{
                      width: `${(unassignedCount / maxAssignmentCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====================================================== */}
      {/* Original Pipeline Breakdown (preserved) */}
      {/* ====================================================== */}

      <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Pipeline Breakdown
        </h2>
        <div className="space-y-3">
          {Object.entries(stageCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([stage, count]) => {
              const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              return (
                <div key={stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="capitalize text-slate-300">
                      {stage.replace(/_/g, " ")}
                    </span>
                    <span className="text-slate-400">
                      {count} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-700">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ====================================================== */}
      {/* Team Activity Feed (admin-only) */}
      {/* ====================================================== */}

      {isAdmin && (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Team Activity Feed (Last 100)
        </h2>
        {!teamActivities || teamActivities.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No team activities found
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-3 py-2 font-medium text-slate-400">When</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Who</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Type</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Lead</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Outcome</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Notes</th>
                </tr>
              </thead>
              <tbody>
                {teamActivities.map((activity) => {
                  const userName = profileMap[activity.user_id] ?? "Unknown";
                  const leadName = leadNameMap[activity.lead_id] ?? "—";
                  const typeLabel =
                    ACTIVITY_TYPE_LABELS[activity.activity_type as ActivityType] ??
                    activity.activity_type;
                  const when = new Date(activity.occurred_at);
                  const timeStr = when.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  }) + " " + when.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={activity.id}
                      className="border-b border-slate-700/30 transition-colors hover:bg-slate-700/20"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                        {timeStr}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-200">
                        {userName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {typeLabel}
                        {activity.is_private && (
                          <span className="ml-1.5 rounded bg-slate-600 px-1 py-0.5 text-[10px] text-slate-400">
                            private
                          </span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-slate-300">
                        {leadName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                        {activity.outcome
                          ? activity.outcome.replace(/_/g, " ")
                          : "—"}
                      </td>
                      <td className="max-w-[300px] truncate px-3 py-2 text-xs text-slate-500">
                        {activity.notes ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
