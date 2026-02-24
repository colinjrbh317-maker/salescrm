import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  // Admin gate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "admin") redirect("/");

  // Get all profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role");

  // Get activity counts per user (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activities } = await supabase
    .from("activities")
    .select("user_id, activity_type")
    .gte("occurred_at", weekAgo);

  // Get leads per user with pipeline stages
  const { data: leads } = await supabase
    .from("leads")
    .select("assigned_to, pipeline_stage, close_amount");

  // Build leaderboard data
  const userStats: Record<
    string,
    {
      name: string;
      role: string;
      activities: number;
      totalLeads: number;
      closedWon: number;
      revenue: number;
    }
  > = {};

  if (profiles) {
    for (const profile of profiles) {
      userStats[profile.id] = {
        name: profile.full_name ?? "Unknown",
        role: profile.role,
        activities: 0,
        totalLeads: 0,
        closedWon: 0,
        revenue: 0,
      };
    }
  }

  if (activities) {
    for (const activity of activities) {
      if (userStats[activity.user_id]) {
        userStats[activity.user_id].activities++;
      }
    }
  }

  if (leads) {
    for (const lead of leads) {
      if (lead.assigned_to && userStats[lead.assigned_to]) {
        userStats[lead.assigned_to].totalLeads++;
        if (lead.pipeline_stage === "closed_won") {
          userStats[lead.assigned_to].closedWon++;
          userStats[lead.assigned_to].revenue += lead.close_amount ?? 0;
        }
      }
    }
  }

  const leaderboard = Object.entries(userStats)
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.activities - a.activities);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Team performance rankings - last 7 days
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-12 text-center">
          <p className="text-slate-500">
            No team members found. Create accounts to see the leaderboard.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                <th className="px-4 py-3 font-medium text-slate-300">Rank</th>
                <th className="px-4 py-3 font-medium text-slate-300">Name</th>
                <th className="px-4 py-3 font-medium text-slate-300">Role</th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  Activities (7d)
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  Total Leads
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  Closed Won
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((lbUser, index) => {
                const isCurrentUser = lbUser.id === user?.id;
                return (
                <tr
                  key={lbUser.id}
                  className={`border-b border-slate-700/50 transition-colors hover:bg-slate-800/50 ${
                    isCurrentUser ? "bg-blue-900/20 border-l-2 border-l-blue-500" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-yellow-500 text-yellow-900"
                          : index === 1
                          ? "bg-slate-400 text-slate-900"
                          : index === 2
                          ? "bg-amber-700 text-amber-100"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">
                    {lbUser.name}
                    {isCurrentUser && <span className="ml-2 text-xs text-blue-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-400">
                    {lbUser.role}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-400">
                    {lbUser.activities}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {lbUser.totalLeads}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400">
                    {lbUser.closedWon}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">
                    ${lbUser.revenue.toLocaleString()}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
