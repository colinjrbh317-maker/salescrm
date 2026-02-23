import type { Activity, ActivityType, Channel, Outcome } from "@/lib/types";
import {
    ACTIVITY_TYPE_LABELS,
    CHANNEL_LABELS,
    OUTCOME_LABELS,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
    Phone,
    Mail,
    MessageCircle,
    User,
    Calendar,
    FileText,
    FileEdit,
    ArrowRightLeft
} from "lucide-react";

const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
    cold_call: Phone,
    cold_email: Mail,
    social_dm: MessageCircle,
    walk_in: User,
    follow_up_call: Phone,
    follow_up_email: Mail,
    meeting: Calendar,
    proposal_sent: FileText,
    note: FileEdit,
    stage_change: ArrowRightLeft,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
    cold_call: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    cold_email: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    social_dm: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    walk_in: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    follow_up_call: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    follow_up_email: "bg-primary/10 text-primary border-primary/20",
    meeting: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    proposal_sent: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    note: "bg-secondary text-foreground border-border/40",
    stage_change: "bg-secondary text-foreground border-border/40",
};

function ActivityIcon({ type }: { type: ActivityType }) {
    const Icon = ACTIVITY_ICONS[type] ?? FileEdit;
    const colorClass = ACTIVITY_COLORS[type] ?? "bg-secondary text-foreground border-border/40";

    return (
        <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 shadow-md border backdrop-blur-sm ${colorClass}`}>
            <Icon className="h-4 w-4" strokeWidth={2.5} />
        </div>
    );
}

function formatTimestamp(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
        const mins = Math.floor(diffMs / (1000 * 60));
        return mins <= 0 ? "Just now" : `${mins}m ago`;
    }
    if (diffHours < 24) {
        return `${Math.floor(diffHours)}h ago`;
    }
    if (diffHours < 48) {
        return "Yesterday";
    }
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}

interface ActivityTimelineProps {
    activities: Activity[];
    currentUserId: string;
}

export function ActivityTimeline({
    activities,
    currentUserId,
}: ActivityTimelineProps) {
    const visibleActivities = activities.filter(
        (a) => !a.is_private || a.user_id === currentUserId
    );

    if (visibleActivities.length === 0) {
        return (
            <div className="py-12 border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center text-center backdrop-blur-sm bg-card/30">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                    <FileEdit className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No activities yet</p>
                <p className="text-sm text-muted-foreground mt-1">Record your first interaction using the logger.</p>
            </div>
        );
    }

    return (
        <div className="space-y-0 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/40 before:to-transparent">
            {visibleActivities.map((activity, index) => (
                <div key={activity.id} className="relative flex items-start gap-4 pb-8 group">
                    {/* Vertical line connecting icons - absolute positioned over the background line */}
                    {index < visibleActivities.length - 1 && (
                        <div className="absolute left-[17px] top-9 h-full w-px bg-border/40" />
                    )}

                    <ActivityIcon type={activity.activity_type} />

                    <div className="min-w-0 flex-1 pt-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-foreground">
                                    {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                                </span>
                                {activity.channel && (
                                    <Badge variant="secondary" className="bg-secondary hover:bg-secondary/80 text-muted-foreground font-medium tracking-wide">
                                        {CHANNEL_LABELS[activity.channel as Channel] ?? activity.channel}
                                    </Badge>
                                )}
                                {activity.outcome && (
                                    <Badge variant="outline" className="border-border/40 text-muted-foreground font-medium tracking-wide">
                                        {OUTCOME_LABELS[activity.outcome as Outcome] ?? activity.outcome}
                                    </Badge>
                                )}
                                {activity.is_private && (
                                    <Badge variant="outline" className="border-border/40 bg-background/50 text-muted-foreground font-semibold gap-1 tracking-wide">
                                        Private
                                    </Badge>
                                )}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap mt-1 sm:mt-0 font-mono">
                                {formatTimestamp(activity.occurred_at)}
                            </span>
                        </div>

                        {activity.notes && (
                            <p className="mt-2 text-sm text-foreground bg-secondary/50 border border-border/40 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
                                {activity.notes}
                            </p>
                        )}

                        {activity.duration_sec ? (
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Duration: {Math.floor(activity.duration_sec / 60)}m {activity.duration_sec % 60}s
                            </p>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}
