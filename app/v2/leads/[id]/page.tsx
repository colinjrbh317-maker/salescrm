import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Lead, Activity, Cadence, LeadNote } from "@/lib/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
// Temporarily import the v1 components, we will replace them as we build the v2 versions
import { SalesIntelligence } from "../../../(dashboard)/leads/[id]/sales-intelligence";
import { AiBriefingSection } from "./ai-briefing";
import { ActivityTimeline } from "./activity-timeline";
import { ActivityLogger } from "./activity-logger";
import { CadenceManager } from "./cadence-manager";
import { LeadHeader } from "./lead-header";
import { BestTimeToCall } from "../../../(dashboard)/leads/[id]/best-time-to-call";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function V2LeadDetailPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    // Fetch lead
    const { data: lead, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !lead) {
        notFound();
    }

    // Fetch activities
    const { data: activities } = await supabase
        .from("activities")
        .select("*")
        .eq("lead_id", id)
        .order("occurred_at", { ascending: false });

    // Fetch cadences
    const { data: cadences } = await supabase
        .from("cadences")
        .select("*")
        .eq("lead_id", id)
        .order("step_number", { ascending: true });

    return (
        <div className="flex min-h-screen flex-col bg-transparent">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-8 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-20 w-full shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <SidebarTrigger />
                    <div className="flex items-center gap-2">
                        <Link href="/v2/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Leads
                        </Link>
                    </div>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                <div className="mx-auto max-w-7xl">

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        {/* LEFT COLUMN: Context & Action (8 cols) */}
                        <div className="lg:col-span-8 space-y-6">

                            <LeadHeader lead={lead as Lead} />

                            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-md shadow-black/20 backdrop-blur-sm">
                                <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Log Activity
                                </h2>
                                <ActivityLogger
                                    leadId={id}
                                    currentUserId={user.id}
                                />
                            </div>

                            {/* Native styling for notes to remove vibe-coded UI */}
                            {(() => {
                                const notes = ((lead as Lead).notes as LeadNote[] | null) ?? [];
                                if (notes.length === 0) return null;
                                return (
                                    <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-md shadow-black/20 backdrop-blur-sm">
                                        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Notes
                                        </h2>
                                        <div className="space-y-4">
                                            {notes
                                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .map((note) => (
                                                    <div
                                                        key={note.id}
                                                        className="rounded-xl border border-border/40 bg-secondary p-4"
                                                    >
                                                        <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                                );
                            })()}

                            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-md shadow-black/20 backdrop-blur-sm">
                                <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Activity Timeline
                                </h2>
                                <ActivityTimeline
                                    activities={(activities ?? []) as Activity[]}
                                    currentUserId={user.id}
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Intelligence & Next Steps (4 cols) */}
                        <div className="lg:col-span-4 space-y-6">

                            <AiBriefingSection lead={lead as Lead} />

                            <BestTimeToCall
                                lead={lead as Lead}
                                activities={(activities ?? []) as Activity[]}
                            />

                            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-md shadow-black/20 backdrop-blur-sm">
                                <CadenceManager
                                    leadId={id}
                                    currentUserId={user.id}
                                    cadences={(cadences ?? []) as Cadence[]}
                                />
                            </div>

                            <SalesIntelligence lead={lead as Lead} />

                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
