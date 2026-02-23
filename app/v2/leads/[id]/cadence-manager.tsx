"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Cadence, ActivityType } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleDashed, FastForward, PlayCircle } from "lucide-react";

interface CadenceStep {
    dayOffset: number;
    activityType: ActivityType;
}

interface CadenceTemplate {
    name: string;
    description: string;
    steps: CadenceStep[];
}

const CADENCE_TEMPLATES: CadenceTemplate[] = [
    {
        name: "Standard Outreach",
        description: "Balanced 7-step sequence across all channels over 21 days",
        steps: [
            { dayOffset: 0, activityType: "cold_call" },
            { dayOffset: 1, activityType: "cold_email" },
            { dayOffset: 3, activityType: "social_dm" },
            { dayOffset: 5, activityType: "follow_up_call" },
            { dayOffset: 7, activityType: "follow_up_email" },
            { dayOffset: 14, activityType: "follow_up_call" },
            { dayOffset: 21, activityType: "walk_in" },
        ],
    },
    {
        name: "Digital First",
        description: "Email and social-heavy 5-step sequence over 14 days",
        steps: [
            { dayOffset: 0, activityType: "cold_email" },
            { dayOffset: 2, activityType: "social_dm" },
            { dayOffset: 4, activityType: "social_dm" },
            { dayOffset: 7, activityType: "follow_up_email" },
            { dayOffset: 14, activityType: "cold_call" },
        ],
    },
];

const ACTIVITY_COLORS: Record<string, string> = {
    cold_call: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    cold_email: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    social_dm: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    follow_up_call: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    follow_up_email: "bg-primary/10 text-primary border-primary/20",
    walk_in: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    meeting: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

interface CadenceManagerProps {
    leadId: string;
    currentUserId: string;
    cadences: Cadence[];
}

export function CadenceManager({ leadId, currentUserId, cadences }: CadenceManagerProps) {
    const [starting, setStarting] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const hasActiveCadence = cadences.length > 0;

    async function startCadence(template: CadenceTemplate) {
        setStarting(true);
        const now = new Date();
        const rows = template.steps.map((step, index) => {
            const scheduledDate = new Date(now);
            scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);
            return {
                lead_id: leadId,
                user_id: currentUserId,
                step_number: index + 1,
                channel: step.activityType,
                scheduled_at: scheduledDate.toISOString(),
                completed_at: null,
                skipped: false,
            };
        });

        const { error } = await supabase.from("cadences").insert(rows);
        if (!error) router.refresh();
        setStarting(false);
    }

    async function markCompleted(cadenceId: string) {
        setUpdatingId(cadenceId);
        const { error } = await supabase.from("cadences").update({ completed_at: new Date().toISOString() }).eq("id", cadenceId);
        if (!error) router.refresh();
        setUpdatingId(null);
    }

    async function markSkipped(cadenceId: string) {
        setUpdatingId(cadenceId);
        const { error } = await supabase.from("cadences").update({ skipped: true }).eq("id", cadenceId);
        if (!error) router.refresh();
        setUpdatingId(null);
    }

    function formatScheduledDate(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays === -1) return "Yesterday";
        if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
        return `In ${diffDays}d`;
    }

    if (!hasActiveCadence) {
        return (
            <div className="flex flex-col gap-4">
                <div className="mb-2">
                    <h2 className="text-lg font-bold text-foreground">Sales Cadence</h2>
                    <p className="text-sm text-muted-foreground">Select a template to automate outreach tasks.</p>
                </div>

                {CADENCE_TEMPLATES.map((template) => (
                    <Card key={template.name} className="shadow-none border-border/40 bg-background/50 rounded-xl backdrop-blur-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <CardTitle className="text-base text-foreground">{template.name}</CardTitle>
                                    <CardDescription className="text-muted-foreground mt-1.5">{template.description}</CardDescription>
                                </div>
                                <Button
                                    onClick={() => startCadence(template)}
                                    disabled={starting}
                                    size="sm"
                                    className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_12px_rgba(34,197,94,0.3)] flex-shrink-0 rounded-lg font-semibold"
                                >
                                    <PlayCircle className="w-4 h-4 mr-2" />
                                    {starting ? "Starting..." : "Start"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {template.steps.map((step, i) => {
                                    const colorClass = ACTIVITY_COLORS[step.activityType] || "bg-secondary text-foreground border-border/40";
                                    return (
                                        <Badge key={i} variant="outline" className={`font-medium shadow-sm transition-colors ${colorClass}`}>
                                            D{step.dayOffset} &middot; {ACTIVITY_TYPE_LABELS[step.activityType]}
                                        </Badge>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const sortedCadences = [...cadences].sort((a, b) => a.step_number - b.step_number);
    const completedCount = cadences.filter((c) => c.completed_at).length;
    const skippedCount = cadences.filter((c) => c.skipped).length;
    const totalSteps = cadences.length;
    const progressPct = totalSteps > 0 ? Math.round(((completedCount + skippedCount) / totalSteps) * 100) : 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Active Cadence</h2>
                    <p className="text-sm text-muted-foreground">Automated sequence in progress</p>
                </div>
                <div className="text-right">
                    <span className="text-sm font-semibold text-primary">{progressPct}%</span>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{completedCount}/{totalSteps} steps</p>
                </div>
            </div>

            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden mb-4 border border-border/40 shadow-inner">
                <div className="h-full bg-primary transition-all duration-500 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.6)]" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="relative border-l-2 border-border/40 ml-3 space-y-6 mt-2">
                {sortedCadences.map((cadence, index) => {
                    const isDone = !!cadence.completed_at || cadence.skipped;
                    const isUpdating = updatingId === cadence.id;
                    const isDue = !isDone && new Date(cadence.scheduled_at) <= new Date();

                    return (
                        <div key={cadence.id} className="relative pl-6">
                            {/* Timeline Dot */}
                            <div className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full border-2 bg-background flex items-center justify-center ${cadence.completed_at ? "border-primary text-primary shadow-[0_0_8px_rgba(34,197,94,0.4)]" :
                                cadence.skipped ? "border-border text-muted-foreground/50" :
                                    isDue ? "border-orange-400 text-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" : "border-border text-muted-foreground"
                                }`}>
                                {cadence.completed_at ? <CheckCircle2 className="w-3 h-3" /> :
                                    cadence.skipped ? <FastForward className="w-3 h-3" /> :
                                        <CircleDashed className={`w-3 h-3 ${isDue ? 'animate-[spin_4s_linear_infinite]' : ''}`} />}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 p-4 bg-secondary/20 border border-border/40 rounded-xl shadow-sm hover:shadow-md transition-all hover:border-border backdrop-blur-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Step {cadence.step_number}</span>
                                        {isDue && !isDone && <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 uppercase font-bold tracking-wider text-[10px] py-0 px-1.5">Action Req</Badge>}
                                    </div>

                                    <p className="font-semibold text-foreground text-sm mb-1">
                                        {ACTIVITY_TYPE_LABELS[cadence.channel as ActivityType] ?? cadence.channel}
                                    </p>

                                    <p className="text-xs font-medium text-muted-foreground">
                                        {cadence.completed_at ? (
                                            <span className="text-primary flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Done {new Date(cadence.completed_at).toLocaleDateString()}</span>
                                        ) : cadence.skipped ? (
                                            <span className="text-muted-foreground/50 flex items-center gap-1.5"><FastForward className="w-3.5 h-3.5" /> Skipped</span>
                                        ) : (
                                            <span className={isDue ? "text-orange-400 font-bold" : ""}>Scheduled: {formatScheduledDate(cadence.scheduled_at)}</span>
                                        )}
                                    </p>
                                </div>

                                {!isDone && (
                                    <div className="flex items-center gap-2 mt-2 sm:mt-0 shadow-sm rounded-lg overflow-hidden bg-background">
                                        <Button
                                            onClick={() => markCompleted(cadence.id)}
                                            disabled={isUpdating}
                                            variant="outline"
                                            size="sm"
                                            className="border-primary/20 text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary rounded-none rounded-l-lg"
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                            Mark Done
                                        </Button>
                                        <Button
                                            onClick={() => markSkipped(cadence.id)}
                                            disabled={isUpdating}
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-none rounded-r-lg border-y border-r border-border/40"
                                        >
                                            Skip
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
