import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { Lead, Activity, Cadence, LeadNote, ActivityType } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import { SalesIntelligence } from "@/app/(dashboard)/leads/[id]/sales-intelligence";
import { AiBriefingSection } from "@/app/(dashboard)/leads/[id]/ai-briefing";
import { ActivityTimeline } from "@/app/(dashboard)/leads/[id]/activity-timeline";
import { CadenceManager } from "@/app/(dashboard)/leads/[id]/cadence-manager";
import { LeadHeader } from "@/app/(dashboard)/leads/[id]/lead-header";
import { BestTimeToCall } from "@/app/(dashboard)/leads/[id]/best-time-to-call";
import { LeadDetailTabs } from "@/app/(dashboard)/leads/[id]/lead-detail-tabs";
import { EnrichmentLog } from "@/app/(dashboard)/leads/[id]/enrichment-log";
import LeadOutreach from "@/app/(dashboard)/leads/[id]/lead-outreach";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadFocusPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lead) {
    notFound();
  }

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", id)
    .order("occurred_at", { ascending: false });

  const { data: cadences } = await supabase
    .from("cadences")
    .select("*")
    .eq("lead_id", id)
    .order("step_number", { ascending: true });

  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, full_name");

  const notes = ((lead as Lead).notes as LeadNote[] | null) ?? [];

  const nextAction = (cadences as Cadence[] ?? [])
    .filter((c) => !c.completed_at && !c.skipped)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;

  const nextActionDue = nextAction
    ? (() => {
        const days = Math.ceil(
          (new Date(nextAction.scheduled_at).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "border-red-700 bg-red-900/20 text-red-300" };
        if (days === 0) return { text: "Due today", color: "border-amber-700 bg-amber-900/20 text-amber-300" };
        if (days === 1) return { text: "Due tomorrow", color: "border-blue-700 bg-blue-900/20 text-blue-300" };
        return { text: `Due in ${days}d`, color: "border-slate-600 bg-slate-800 text-slate-300" };
      })()
    : null;

  return (
    <div className="w-full px-3 py-3">
      <LeadHeader
        lead={lead as Lead}
        currentUserId={user.id}
        teamMembers={teamMembers ?? []}
        focusMode
      />

      {nextAction && nextActionDue && (
        <div className={`mt-3 rounded-lg border px-4 py-3 ${nextActionDue.color}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Next Action</span>
              <span className="text-sm font-medium">
                {ACTIVITY_TYPE_LABELS[nextAction.channel as ActivityType] ?? nextAction.channel}
              </span>
            </div>
            <span className="text-xs font-medium">{nextActionDue.text}</span>
          </div>
        </div>
      )}

      <LeadDetailTabs
        overview={
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AiBriefingSection lead={lead as Lead} />
              </div>
              <div className="lg:col-span-1">
                <SalesIntelligence lead={lead as Lead} />
              </div>
            </div>

            <div className="mt-4">
              <BestTimeToCall
                lead={lead as Lead}
                activities={(activities ?? []) as Activity[]}
              />
            </div>

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

            <EnrichmentLog lead={lead as Lead} />
          </>
        }
        activity={
          <ActivityTimeline
            activities={(activities ?? []) as Activity[]}
            currentUserId={user.id}
          />
        }
        cadence={
          <CadenceManager
            leadId={id}
            currentUserId={user.id}
            cadences={(cadences ?? []) as Cadence[]}
            lead={lead as Lead}
          />
        }
        outreach={
          <LeadOutreach
            lead={lead as Lead}
            currentUserId={user.id}
            cadences={(cadences ?? []) as Cadence[]}
          />
        }
      />
    </div>
  );
}
