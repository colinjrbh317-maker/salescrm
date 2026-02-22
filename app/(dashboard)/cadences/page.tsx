import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CadenceHub } from "./cadence-hub";

export default async function CadencesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch ALL incomplete cadences (team-wide) with lead info
  const { data: cadences } = await supabase
    .from("cadences")
    .select("*, leads!inner(id, name, category, city)")
    .is("completed_at", null)
    .eq("skipped", false)
    .order("scheduled_at", { ascending: true });

  // Fetch team profiles for the member selector
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Cadence Hub</h1>
        <p className="mt-1 text-sm text-slate-400">
          All your pending outreach steps in one place
        </p>
      </div>

      <CadenceHub
        cadences={cadences ?? []}
        currentUserId={user.id}
        teamProfiles={profiles ?? []}
      />
    </div>
  );
}
