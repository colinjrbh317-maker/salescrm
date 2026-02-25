"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ActivityType, Channel, Outcome } from "@/lib/types";
import {
    ACTIVITY_TYPE_LABELS,
    CHANNEL_LABELS,
    OUTCOME_LABELS,
    ACTIVITY_CHANNEL_MAP,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ALL_ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];
const ALL_CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];
const ALL_OUTCOMES = Object.keys(OUTCOME_LABELS) as Outcome[];

interface ActivityLoggerProps {
    leadId: string;
    currentUserId: string;
}

export function ActivityLogger({ leadId, currentUserId }: ActivityLoggerProps) {
    const [activityType, setActivityType] = useState<ActivityType>("cold_call");
    const [channel, setChannel] = useState<Channel>("phone");
    const [outcome, setOutcome] = useState<Outcome | "">("");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    function handleActivityTypeChange(type: ActivityType) {
        setActivityType(type);
        const suggestedChannels = ACTIVITY_CHANNEL_MAP[type];
        if (suggestedChannels && suggestedChannels.length > 0) {
            setChannel(suggestedChannels[0]);
        }
    }

    const suggestedChannels = ACTIVITY_CHANNEL_MAP[activityType] ?? ALL_CHANNELS;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setSuccess(false);

        const { error } = await supabase.from("activities").insert({
            lead_id: leadId,
            user_id: currentUserId,
            activity_type: activityType,
            channel: channel,
            outcome: outcome || null,
            notes: notes || null,
            is_private: false,
            occurred_at: new Date().toISOString(),
        });

        if (!error) {
            // Update last_contacted_at
            await supabase
                .from("leads")
                .update({ last_contacted_at: new Date().toISOString() })
                .eq("id", leadId);

            // Auto-advance cadence: find matching pending step and mark completed
            const { data: pendingStep } = await supabase
                .from("cadences")
                .select("id")
                .eq("lead_id", leadId)
                .eq("channel", channel)
                .is("completed_at", null)
                .eq("skipped", false)
                .order("step_number", { ascending: true })
                .limit(1)
                .single();

            if (pendingStep) {
                await supabase
                    .from("cadences")
                    .update({ completed_at: new Date().toISOString() })
                    .eq("id", pendingStep.id);
            }

            setSuccess(true);
            setNotes("");
            setOutcome("");
            router.refresh();
            setTimeout(() => setSuccess(false), 3000);
        }

        setSubmitting(false);
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {/* Activity Type */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Type
                    </label>
                    <select
                        value={activityType}
                        onChange={(e) => handleActivityTypeChange(e.target.value as ActivityType)}
                        className="w-full rounded-xl border border-border/40 bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                    >
                        {ALL_ACTIVITY_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {ACTIVITY_TYPE_LABELS[type]}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Channel */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Channel
                    </label>
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as Channel)}
                        className="w-full rounded-xl border border-border/40 bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                    >
                        {suggestedChannels.map((ch) => (
                            <option key={ch} value={ch}>
                                {CHANNEL_LABELS[ch]}
                            </option>
                        ))}
                        {ALL_CHANNELS.filter((ch) => !suggestedChannels.includes(ch)).map((ch) => (
                            <option key={ch} value={ch}>
                                {CHANNEL_LABELS[ch]}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Outcome */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Outcome
                    </label>
                    <select
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value as Outcome | "")}
                        className="w-full rounded-xl border border-border/40 bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                    >
                        <option value="">Select outcome...</option>
                        {ALL_OUTCOMES.map((o) => (
                            <option key={o} value={o}>
                                {OUTCOME_LABELS[o]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Notes
                </label>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="What happened? Key takeaways..."
                    className="resize-none shadow-sm focus-visible:ring-1 focus-visible:ring-primary border-border/40 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground"
                />
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center justify-between">
                <div className="text-sm font-medium h-5 flex items-center">
                    {success && <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">Activity logged successfully</span>}
                </div>
                <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold shadow-[0_0_12px_rgba(34,197,94,0.3)] rounded-xl transition-all active:scale-[0.98]"
                >
                    {submitting ? "Logging..." : "Log Activity"}
                </Button>
            </div>
        </form>
    );
}
