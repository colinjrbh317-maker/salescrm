import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Session, Lead, Profile } from "@/lib/types";
import SessionSetup from "./session-setup";
import SessionWork from "./session-work";

export default async function SessionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile for goals
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Clean up abandoned sessions (active for >24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "active")
    .lt("started_at", twentyFourHoursAgo);

  // Check for active session
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single<Session>();

  if (activeSession) {
    // Fetch leads for the queue
    const leadIds = activeSession.lead_queue ?? [];
    let leads: Lead[] = [];

    if (leadIds.length > 0) {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .in("id", leadIds);

      if (data) {
        // Preserve queue order
        const leadMap = new Map(data.map((l) => [l.id, l as Lead]));
        leads = leadIds
          .map((id) => leadMap.get(id))
          .filter(Boolean) as Lead[];
      }
    }

    // Fetch scripts for leads that have cadences with script_ids
    const scripts: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: cadencesWithScripts } = await supabase
        .from("cadences")
        .select("lead_id, script_id")
        .in("lead_id", leadIds)
        .not("script_id", "is", null);

      if (cadencesWithScripts && cadencesWithScripts.length > 0) {
        const scriptIds = [
          ...new Set(cadencesWithScripts.map((c) => c.script_id).filter(Boolean)),
        ];
        if (scriptIds.length > 0) {
          const { data: scriptRows } = await supabase
            .from("scripts")
            .select("id, content")
            .in("id", scriptIds);

          if (scriptRows) {
            const scriptMap = new Map(scriptRows.map((s) => [s.id, s.content]));
            for (const c of cadencesWithScripts) {
              if (c.script_id && scriptMap.has(c.script_id)) {
                scripts[c.lead_id] = scriptMap.get(c.script_id)!;
              }
            }
          }
        }
      }
    }

    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <SessionWork
          session={activeSession}
          leads={leads}
          scripts={scripts}
          userId={user.id}
          goals={profile?.goals ?? null}
        />
      </div>
    );
  }

  // No active session — show setup
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SessionSetup userId={user.id} goals={profile?.goals ?? null} />
    </div>
  );
}
