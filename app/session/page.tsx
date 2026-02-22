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
