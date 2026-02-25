import { createClient } from "@/lib/supabase/server";
import { LeadQueue } from "./lead-queue";
import { ReadyToFire } from "./ready-to-fire";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? "";

  // Count pending cadence steps by channel type for Ready to Fire widget
  const now = new Date().toISOString();
  const ninetyDaysAgo = new Date(
    new Date().getTime() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Run independent queries in parallel to reduce dashboard wait time.
  const [
    { data: profile },
    { data: teamMembers },
    { count: emailCount },
    { count: callCount },
    { count: dmCount },
    { count: overdueCount },
    { data: allLeads },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single(),
    supabase.from("profiles").select("id, full_name"),
    supabase
      .from("cadences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("completed_at", null)
      .eq("skipped", false)
      .in("channel", ["email", "cold_email", "follow_up_email"]),
    supabase
      .from("cadences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("completed_at", null)
      .eq("skipped", false)
      .in("channel", ["phone", "cold_call", "follow_up_call"]),
    supabase
      .from("cadences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("completed_at", null)
      .eq("skipped", false)
      .in("channel", ["instagram", "facebook", "tiktok", "social_dm"]),
    supabase
      .from("cadences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("completed_at", null)
      .eq("skipped", false)
      .lt("scheduled_at", now),
    supabase
      .from("leads")
      .select("*")
      .not("pipeline_stage", "in", '("dead")')
      .order("composite_score", { ascending: true }),
  ]);

  // Dead lead recycling: resurface leads dead for 90+ days
  // This runs in background relative to rendered data; behavior is unchanged.
  await supabase
    .from("leads")
    .update({
      pipeline_stage: "cold",
      dead_at: null,
      assigned_to: null,
    })
    .eq("pipeline_stage", "dead")
    .lt("dead_at", ninetyDaysAgo);

  return (
    <div className="space-y-6">
      <ReadyToFire
        emailCount={emailCount ?? 0}
        callCount={callCount ?? 0}
        dmCount={dmCount ?? 0}
        overdueCount={overdueCount ?? 0}
      />
      <LeadQueue
        leads={allLeads ?? []}
        currentUserId={user?.id ?? ""}
        teamMembers={teamMembers ?? []}
        userRole={profile?.role ?? "salesperson"}
      />
    </div>
  );
}
