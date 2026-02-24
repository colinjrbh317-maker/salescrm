import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Lead, Activity, Cadence, LeadNote } from "@/lib/types";
import { SalesIntelligence } from "./sales-intelligence";
import { AiBriefingSection } from "./ai-briefing";
import { ActivityTimeline } from "./activity-timeline";
import { CadenceManager } from "./cadence-manager";
import { LeadHeader } from "./lead-header";
import { BestTimeToCall } from "./best-time-to-call";
import { LeadDetailTabs } from "./lead-detail-tabs";
import { EnrichmentLog } from "./enrichment-log";
import { ActivityLoggerFab } from "./activity-logger-fab";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch lead
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lead) {
    notFound();
  }

  // Fetch activities for this lead
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", id)
    .order("occurred_at", { ascending: false });

  // Fetch cadences for this lead
  const { data: cadences } = await supabase
    .from("cadences")
    .select("*")
    .eq("lead_id", id)
    .order("step_number", { ascending: true });

  // Fetch team members for assignment
  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, full_name");

  const notes = ((lead as Lead).notes as LeadNote[] | null) ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <LeadHeader
        lead={lead as Lead}
        currentUserId={user?.id ?? ""}
        teamMembers={teamMembers ?? []}
      />

      <LeadDetailTabs
        overview={
          <>
            {/* AI Briefing (wide) + Sales Intelligence (sidebar) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AiBriefingSection lead={lead as Lead} />
              </div>
              <div className="lg:col-span-1">
                <SalesIntelligence lead={lead as Lead} />
              </div>
            </div>

            {/* Best Time to Call */}
            <div className="mt-4">
              <BestTimeToCall
                lead={lead as Lead}
                activities={(activities ?? []) as Activity[]}
              />
            </div>

            {/* Notes Section */}
            {notes.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Notes
                </h2>
                <div className="space-y-3">
                  {notes
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((note) => (
                      <div
                        key={note.id}
                        className="rounded-md border border-slate-700 bg-slate-750 p-3"
                      >
                        <p className="text-sm text-slate-200">{note.text}</p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {note.user_name} &middot;{" "}
                          {new Date(note.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Enrichment Log */}
            <EnrichmentLog lead={lead as Lead} />
          </>
        }
        activity={
          <ActivityTimeline
            activities={(activities ?? []) as Activity[]}
            currentUserId={user?.id ?? ""}
          />
        }
        cadence={
          <CadenceManager
            leadId={id}
            currentUserId={user?.id ?? ""}
            cadences={(cadences ?? []) as Cadence[]}
          />
        }
      />

      {/* Floating Activity Logger */}
      <ActivityLoggerFab
        leadId={id}
        currentUserId={user?.id ?? ""}
      />
    </div>
  );
}
