import type { Lead } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Building,
    Globe,
    Lock,
    Smartphone,
    RefreshCcw,
    CheckCircle2,
    XCircle,
    Star,
    Activity
} from "lucide-react";

function ScoreBar({ label, value }: { label: string; value: number | null }) {
    if (value == null) return null;
    const pct = Math.min(100, Math.max(0, value));

    // Use a refined color scale for v2
    const colorClass =
        pct >= 75 ? "bg-primary shadow-[0_0_10px_rgba(34,197,94,0.4)]" : pct >= 50 ? "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.4)]" : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]";

    const bgClass =
        pct >= 75 ? "bg-primary/20" : pct >= 50 ? "bg-orange-500/20" : "bg-rose-500/20";

    return (
        <div className="group">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">{label}</span>
                <span className="text-sm font-bold text-foreground">{value}</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${bgClass}`}>
                <div
                    className={`h-full transition-all duration-500 ease-out rounded-full ${colorClass}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function InfoRow({
    label,
    value,
    icon: Icon,
    positive,
}: {
    label: string;
    value: string | boolean | null;
    icon: React.ElementType;
    positive?: boolean;
}) {
    if (value == null) return null;

    let display: string;
    let isPositive = false;
    let isNegative = false;

    if (typeof value === "boolean") {
        display = value ? "Yes" : "No";
        isPositive = value === positive;
        isNegative = value !== positive;
    } else {
        display = value;
    }

    return (
        <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-secondary/10 transition-colors px-2 -mx-2 rounded-lg">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                {typeof value === 'boolean' && (
                    isPositive ? <CheckCircle2 className="h-4 w-4 text-primary" /> :
                        isNegative ? <XCircle className="h-4 w-4 text-rose-500" /> : null
                )}
                <span className={`text-sm font-semibold ${isPositive ? "text-primary" :
                    isNegative ? "text-rose-500" : "text-foreground"
                    }`}>{display}</span>
            </div>
        </div>
    );
}

export function SalesIntelligence({ lead }: { lead: Lead }) {
    const hasScores =
        lead.design_score != null ||
        lead.technical_score != null ||
        lead.visual_score != null ||
        lead.content_score != null ||
        lead.mobile_score != null ||
        lead.presence_score != null;

    return (
        <Card className="rounded-2xl border border-border/40 shadow-lg shadow-black/20 bg-card">
            <CardHeader className="pb-4 border-b border-border/40 bg-card/50">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Activity className="h-5 w-5 text-blue-400" />
                    Sales Intelligence
                </CardTitle>
            </CardHeader>

            <CardContent className="pt-6 space-y-8 pl-6 pr-6">

                {/* Composite Score Spotlight */}
                {lead.composite_score != null && (
                    <div className="text-center p-6 bg-secondary/20 border border-border/40 rounded-2xl relative overflow-hidden backdrop-blur-sm shadow-inner group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400 opacity-70 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Composite Score</p>
                        <p className={`text-5xl font-black tracking-tighter ${lead.composite_score >= 75 ? "text-primary" :
                            lead.composite_score >= 50 ? "text-orange-400" : "text-rose-500"
                            }`}>
                            {lead.composite_score}
                        </p>
                    </div>
                )}

                {/* Core Metrics */}
                <div>
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Technical Health</h3>
                    <div className="bg-secondary/10 border border-border/40 rounded-xl px-4 py-1 shadow-sm">
                        <InfoRow label="Has Website" value={lead.has_website} positive={true} icon={Globe} />
                        <InfoRow label="SSL Valid" value={lead.ssl_valid} positive={true} icon={Lock} />
                        <InfoRow label="Mobile Friendly" value={lead.mobile_friendly} positive={true} icon={Smartphone} />
                        <InfoRow label="Content Freshness" value={lead.content_freshness} icon={RefreshCcw} />
                    </div>
                </div>

                {/* Quality Scores */}
                {hasScores && (
                    <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4">Quality Breakdown</h3>
                        <div className="space-y-4 px-1">
                            <ScoreBar label="Design" value={lead.design_score} />
                            <ScoreBar label="Technical" value={lead.technical_score} />
                            <ScoreBar label="Visual" value={lead.visual_score} />
                            <ScoreBar label="Content" value={lead.content_score} />
                            <ScoreBar label="Mobile" value={lead.mobile_score} />
                            <ScoreBar label="Presence" value={lead.presence_score} />
                        </div>
                    </div>
                )}

                {/* Google Metrics */}
                {(lead.google_rating != null || lead.review_count != null) && (
                    <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Local SEO</h3>
                        <div className="bg-secondary/10 border border-border/40 rounded-xl p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2">
                                <Building className="h-5 w-5 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">Google Business</span>
                            </div>

                            <div className="flex items-center gap-3">
                                {lead.google_rating != null && (
                                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20 gap-1 px-2 pointer-events-none">
                                        <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                                        {lead.google_rating}
                                    </Badge>
                                )}
                                {lead.review_count != null && (
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                        ({lead.review_count} reviews)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Sources Tags */}
                {lead.sources && lead.sources.length > 0 && (
                    <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 border-t border-border/40 pt-6">
                            Data Sources
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {lead.sources.map((source, i) => (
                                <Badge key={i} variant="outline" className="bg-secondary text-muted-foreground border-border/40 font-bold tracking-wide uppercase text-[10px] px-2 hover:bg-secondary/80">
                                    {source}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
