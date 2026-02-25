"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Mail,
    MessageCircle,
    Phone,
    Clock,
    ArrowRight,
    Sparkles,
    FileText,
    AlertCircle,
} from "lucide-react";

interface OutreachQueueProps {
    cadences: Array<Record<string, unknown>>;
    draftsByLead: Record<string, number>;
    currentUserId: string;
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
    email: Mail,
    phone: Phone,
    instagram: MessageCircle,
    facebook: MessageCircle,
    tiktok: MessageCircle,
    linkedin: MessageCircle,
};

const URGENCY_STYLES = {
    overdue: "bg-destructive/10 text-destructive border-destructive/20",
    today: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    upcoming: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    later: "bg-muted text-muted-foreground border-border/40",
};

function getUrgency(scheduledAt: string): keyof typeof URGENCY_STYLES {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffHours = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < -24) return "overdue";
    if (diffHours < 0) return "today";
    if (diffHours < 48) return "upcoming";
    return "later";
}

function formatDueDate(scheduledAt: string): string {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffDays = Math.ceil(
        (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === -1) return "Yesterday";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays}d`;
}

type TabValue = "all" | "overdue" | "today" | "upcoming";

export function OutreachQueue({
    cadences,
    draftsByLead,
    currentUserId,
}: OutreachQueueProps) {
    const [activeTab, setActiveTab] = useState<TabValue>("all");
    const [generating, setGenerating] = useState<string | null>(null);

    // Build queue items from cadences with lead data
    const queueItems = cadences
        .filter((c) => c.leads && typeof c.leads === "object")
        .map((c) => {
            const lead = c.leads as Record<string, unknown>;
            const urgency = getUrgency(c.scheduled_at as string);
            return {
                cadenceId: c.id as string,
                leadId: lead.id as string,
                leadName: lead.name as string,
                category: lead.category as string | null,
                city: lead.city as string | null,
                priority: lead.priority as string | null,
                channel: c.channel as string,
                stepNumber: c.step_number as number,
                scheduledAt: c.scheduled_at as string,
                urgency,
                hasDrafts: (draftsByLead[lead.id as string] ?? 0) > 0,
                draftCount: draftsByLead[lead.id as string] ?? 0,
                compositeScore: lead.composite_score as number | null,
            };
        });

    // Filter by tab
    const filtered =
        activeTab === "all"
            ? queueItems
            : queueItems.filter((item) => item.urgency === activeTab);

    // Sort: overdue first, then by priority, then by date
    const sorted = [...filtered].sort((a, b) => {
        const urgencyOrder = { overdue: 0, today: 1, upcoming: 2, later: 3 };
        const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgDiff !== 0) return urgDiff;
        const priOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        const priDiff =
            (priOrder[a.priority ?? "LOW"] ?? 2) -
            (priOrder[b.priority ?? "LOW"] ?? 2);
        if (priDiff !== 0) return priDiff;
        return (
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
        );
    });

    const counts = {
        all: queueItems.length,
        overdue: queueItems.filter((i) => i.urgency === "overdue").length,
        today: queueItems.filter((i) => i.urgency === "today").length,
        upcoming: queueItems.filter((i) => i.urgency === "upcoming").length,
    };

    async function handleQuickGenerate(leadId: string, channel: string) {
        setGenerating(leadId);
        try {
            await fetch("/api/generate-outreach", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, channel }),
            });
        } finally {
            setGenerating(null);
        }
    }

    const tabs: { value: TabValue; label: string; count: number }[] = [
        { value: "all", label: "All", count: counts.all },
        { value: "overdue", label: "Overdue", count: counts.overdue },
        { value: "today", label: "Today", count: counts.today },
        { value: "upcoming", label: "Upcoming", count: counts.upcoming },
    ];

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                            activeTab === tab.value
                                ? "border-primary/40 bg-primary/5 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                                : "border-border/40 bg-card hover:border-border"
                        }`}
                    >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {tab.label}
                        </p>
                        <p className="text-2xl font-bold font-mono text-foreground mt-1">
                            {tab.count}
                        </p>
                    </button>
                ))}
            </div>

            {/* Queue List */}
            {sorted.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-muted-foreground text-sm">
                        No outreach tasks{activeTab !== "all" ? ` ${activeTab}` : ""}. You're caught up.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sorted.map((item) => {
                        const ChannelIcon =
                            CHANNEL_ICONS[item.channel] || MessageCircle;
                        const isGenerating = generating === item.leadId;

                        return (
                            <div
                                key={item.cadenceId}
                                className="flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm hover:shadow-md hover:border-border transition-all backdrop-blur-sm"
                            >
                                {/* Channel Icon */}
                                <div
                                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${URGENCY_STYLES[item.urgency]}`}
                                >
                                    <ChannelIcon className="w-5 h-5" />
                                </div>

                                {/* Lead Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <Link
                                            href={`/v2/leads/${item.leadId}`}
                                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate"
                                        >
                                            {item.leadName}
                                        </Link>
                                        {item.priority && (
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-bold ${
                                                    item.priority === "HIGH"
                                                        ? "text-destructive border-destructive/20 bg-destructive/10"
                                                        : item.priority === "MEDIUM"
                                                          ? "text-chart-3 border-chart-3/20 bg-chart-3/10"
                                                          : "text-primary border-primary/20 bg-primary/10"
                                                }`}
                                            >
                                                {item.priority}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {item.category && (
                                            <span>{item.category}</span>
                                        )}
                                        {item.city && <span>{item.city}</span>}
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Step {item.stepNumber}
                                        </span>
                                    </div>
                                </div>

                                {/* Due Date */}
                                <div className="flex-shrink-0 text-right">
                                    <Badge
                                        variant="outline"
                                        className={`font-semibold ${URGENCY_STYLES[item.urgency]}`}
                                    >
                                        {item.urgency === "overdue" && (
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                        )}
                                        {formatDueDate(item.scheduledAt)}
                                    </Badge>
                                </div>

                                {/* Actions */}
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    {item.hasDrafts ? (
                                        <Link href={`/v2/leads/${item.leadId}`}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-primary/20 text-primary bg-primary/10 hover:bg-primary/20 text-xs"
                                            >
                                                <FileText className="w-3.5 h-3.5 mr-1.5" />
                                                {item.draftCount} draft{item.draftCount > 1 ? "s" : ""}
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                handleQuickGenerate(
                                                    item.leadId,
                                                    item.channel
                                                )
                                            }
                                            disabled={isGenerating}
                                            className="border-border/40 text-xs"
                                        >
                                            <Sparkles
                                                className={`w-3.5 h-3.5 mr-1.5 ${isGenerating ? "animate-spin" : ""}`}
                                            />
                                            {isGenerating
                                                ? "Generating..."
                                                : "Generate"}
                                        </Button>
                                    )}

                                    <Link href={`/v2/leads/${item.leadId}`}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
