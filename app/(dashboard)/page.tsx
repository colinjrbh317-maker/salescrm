import { createClient } from "@/lib/supabase/server";
import { LeadQueue } from "./lead-queue";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user profile for role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  // Fetch all team members for round-robin assignment
  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, full_name");

  // Fetch hot leads
  const { data: hotLeads } = await supabase
    .from("leads")
    .select("id, name, category, city, composite_score, pipeline_stage")
    .eq("is_hot", true)
    .not("pipeline_stage", "in", '("closed_won","closed_lost","dead")')
    .order("composite_score", { ascending: true })
    .limit(5);

  // Fetch all active leads for the queue
  const { data: allLeads } = await supabase
    .from("leads")
    .select("*")
    .not("pipeline_stage", "in", '("dead")')
    .order("composite_score", { ascending: true });

  // Dead lead recycling: resurface leads dead for 90+ days
  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

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
    <div>
      <LeadQueue
        leads={allLeads ?? []}
        hotLeads={hotLeads ?? []}
        currentUserId={user?.id ?? ""}
        teamMembers={teamMembers ?? []}
        userRole={profile?.role ?? "salesperson"}
      />
    </div>
  );
}
