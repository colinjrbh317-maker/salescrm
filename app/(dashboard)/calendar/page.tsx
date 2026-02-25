import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Date range: 60 days back, 60 days forward from today
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 60);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 60);

  // Fetch cadences with joined leads within date range
  const { data: cadences } = await supabase
    .from("cadences")
    .select(
      "*, leads!inner(id, name, category, city, website, pipeline_stage, composite_score, ai_briefing, enriched_at)"
    )
    .eq("user_id", user.id)
    .gte("scheduled_at", startDate.toISOString())
    .lte("scheduled_at", endDate.toISOString())
    .order("scheduled_at", { ascending: true });

  // Today's completion stats
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayCadences = (cadences ?? []).filter((c) => {
    const d = new Date(c.scheduled_at);
    return d >= todayStart && d < todayEnd;
  });

  const todayTotal = todayCadences.length;
  const todayCompleted = todayCadences.filter(
    (c) => c.completed_at !== null
  ).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your outreach command center — view, act, and reschedule
        </p>
      </div>

      <CalendarView
        cadences={cadences ?? []}
        todayTotal={todayTotal}
        todayCompleted={todayCompleted}
      />
    </div>
  );
}
