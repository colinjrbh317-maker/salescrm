import type { Lead } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Bot,
    Phone,
    Mail,
    MessageCircle,
    User,
    MessageSquare,
    Sparkles,
    Clock,
    Target,
    PenTool,
    AlertCircle
} from "lucide-react";

// For TikTok/Facebook/Instagram, we can use generic icons or specific ones from lucide if available.
import { Instagram, Facebook } from "lucide-react";
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
);

const CHANNEL_ICONS: Record<string, React.ElementType> = {
    phone: Phone,
    email: Mail,
    instagram: Instagram,
    tiktok: TikTokIcon,
    in_person: User,
    facebook: Facebook,
};

const CHANNEL_COLORS: Record<string, string> = {
    phone: "bg-primary/10 text-primary border-primary/20",
    email: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    tiktok: "bg-secondary text-foreground border-border/40",
    in_person: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    facebook: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export function AiBriefingSection({ lead }: { lead: Lead }) {
    const briefing = lead.ai_briefing;

    if (!briefing) {
        return (
            <Card className="rounded-2xl border border-border/40 bg-card shadow-md shadow-black/20 h-full backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border/40 bg-secondary/30">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                        <Bot className="h-5 w-5 text-muted-foreground" />
                        AI Briefing
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-8 pb-10 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                        <Bot className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No AI briefing generated yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Briefings will be auto-generated after prospecting.</p>
                </CardContent>
            </Card>
        );
    }

    const recChannel = briefing.recommended_channel ?? lead.ai_channel_rec ?? "phone";
    const RecommendedIcon = CHANNEL_ICONS[recChannel] ?? Phone;

    return (
        <Card className="rounded-2xl border border-border/40 bg-card shadow-md shadow-black/20 overflow-hidden backdrop-blur-sm">
            <CardHeader className="pb-4 border-b border-border/40 bg-secondary/30">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                    AI Briefing
                </CardTitle>
            </CardHeader>

            <CardContent className="pt-6 space-y-8">
                {/* Top Summary Row */}
                <div className="flex flex-col md:flex-row gap-6">

                    {/* Summary Text */}
                    {briefing.summary && (
                        <div className="flex-1">
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</h3>
                            <p className="text-sm leading-relaxed text-foreground">{briefing.summary}</p>
                        </div>
                    )}

                    {/* Recommendations Panel */}
                    {(briefing.recommended_channel || briefing.best_time_to_call) && (
                        <div className="md:w-72 shrink-0 bg-secondary/40 rounded-xl p-4 border border-border/40 flex flex-col gap-4">

                            {briefing.recommended_channel && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Best Channel</h3>
                                    <Badge variant="outline" className={`font-semibold items-center gap-1.5 px-2.5 py-1 shadow-sm ${CHANNEL_COLORS[recChannel] || "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                                        <RecommendedIcon className="h-3.5 w-3.5" />
                                        {recChannel.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                    </Badge>
                                    {briefing.channel_reasoning && (
                                        <p className="text-xs text-foreground/80 mt-2 leading-relaxed">{briefing.channel_reasoning}</p>
                                    )}
                                </div>
                            )}

                            {briefing.best_time_to_call && (
                                <div className="pt-3 border-t border-border/40">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" /> Best Time
                                    </h3>
                                    <p className="text-sm font-medium text-foreground">{briefing.best_time_to_call}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Audience & Content (for creators/podcasters) */}
                {(briefing.audience_profile || briefing.content_style) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {briefing.audience_profile && (
                            <div className="bg-chart-4/10 border border-chart-4/20 rounded-xl p-4 backdrop-blur-sm">
                                <h3 className="text-[10px] font-bold text-chart-4 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Target className="h-3.5 w-3.5" /> Audience Profile
                                </h3>
                                <p className="text-sm leading-relaxed text-foreground">{briefing.audience_profile}</p>
                            </div>
                        )}
                        {briefing.content_style && (
                            <div className="bg-chart-2/10 border border-chart-2/20 rounded-xl p-4 backdrop-blur-sm">
                                <h3 className="text-[10px] font-bold text-chart-2 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <PenTool className="h-3.5 w-3.5" /> Content Style
                                </h3>
                                <p className="text-sm leading-relaxed text-foreground">{briefing.content_style}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Talking Points & Objections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 border-t border-border/40">

                    {/* Talking Points */}
                    {briefing.talking_points && briefing.talking_points.length > 0 && (
                        <div>
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <MessageSquare className="h-4 w-4 text-primary" /> Talking Points
                            </h3>
                            <ul className="space-y-3">
                                {briefing.talking_points.map((point, i) => (
                                    <li key={i} className="flex items-start gap-3 bg-secondary/80 p-3 rounded-xl border border-border/40 shadow-sm transition-shadow duration-200 hover:shadow-md cursor-default">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary mt-0.5 shadow-[0_0_8px_rgba(34,197,94,0.2)]">
                                            {i + 1}
                                        </span>
                                        <span className="text-sm leading-relaxed text-foreground">{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Objections */}
                    {briefing.objections && briefing.objections.length > 0 && (
                        <div>
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <AlertCircle className="h-4 w-4 text-amber-500" /> Key Objections
                            </h3>
                            <ul className="space-y-3">
                                {briefing.objections.map((objection, i) => (
                                    <li key={i} className="flex items-start gap-3 bg-destructive/10 p-3 rounded-xl border border-destructive/20 shadow-sm text-foreground/90 border-l-2 border-l-destructive/80 cursor-default">
                                        <span className="text-sm leading-relaxed">{objection}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                </div>
            </CardContent>
        </Card>
    );
}
