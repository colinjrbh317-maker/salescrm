import type { Lead } from "@/lib/types";
import {
    PIPELINE_STAGE_LABELS,
    PRIORITY_COLORS,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Globe, Instagram, Facebook } from "lucide-react";

// For TikTok we can use a generic icon or text since lucide doesn't have a specific TikTok icon
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
);

function getEnrichmentStatus(enrichedAt: string | null): { label: string; style: string } {
    if (!enrichedAt) return { label: "Not Enriched", style: "bg-muted text-muted-foreground border-border/40" };
    const daysSince = Math.floor((Date.now() - new Date(enrichedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 7) return { label: "Fresh", style: "bg-primary/10 text-primary border-primary/20" };
    if (daysSince <= 30) return { label: "Aging", style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
    return { label: "Stale", style: "bg-destructive/10 text-destructive border-destructive/20" };
}

function getStageBadgeStyles(stage: string): string {
    switch (stage) {
        case "cold": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
        case "contacted": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        case "warm": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
        case "proposal": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
        case "negotiation": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
        case "closed_won": return "bg-primary/10 text-primary border-primary/20";
        case "closed_lost": return "bg-destructive/10 text-destructive border-destructive/20";
        case "dead": return "bg-muted text-muted-foreground border-border/40";
        default: return "bg-secondary text-secondary-foreground border-border/40";
    }
}

export function LeadHeader({ lead }: { lead: Lead }) {
    return (
        <div className="rounded-2xl border border-border/40 bg-card p-6 sm:p-8 shadow-md shadow-black/20 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">

                {/* Left Info Column */}
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            {lead.website && (
                                <img
                                    src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(lead.website.replace(/^https?:\/\//, ""))}&sz=32`}
                                    alt=""
                                    className="h-6 w-6 rounded shrink-0"
                                    loading="lazy"
                                />
                            )}
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">{lead.name}</h1>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            {lead.category && (
                                <span className="font-medium text-foreground">{lead.category}</span>
                            )}
                            {lead.city && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4 text-muted-foreground/60" />
                                    {lead.address ? `${lead.address}, ` : ""}
                                    {lead.city}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contact Links */}
                    <div className="flex flex-wrap items-center gap-4">
                        {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/20 border border-primary/20 px-3 py-1.5 rounded-md active:scale-[0.98] cursor-pointer">
                                <Phone className="h-4 w-4" />
                                {lead.phone}
                            </a>
                        )}
                        {lead.email && (
                            <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-1.5 rounded-md active:scale-[0.98] cursor-pointer">
                                <Mail className="h-4 w-4" />
                                {lead.email}
                            </a>
                        )}
                        {lead.website && (
                            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors bg-secondary hover:bg-secondary/80 border border-border/40 px-3 py-1.5 rounded-md active:scale-[0.98] cursor-pointer">
                                <Globe className="h-4 w-4" />
                                Website
                            </a>
                        )}
                    </div>
                </div>

                {/* Right Status Column */}
                <div className="flex flex-col items-start lg:items-end gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {lead.priority && (
                            <Badge variant="outline" className={`capitalize font-semibold ${lead.priority === 'HIGH' ? 'text-destructive border-destructive/20 bg-destructive/10' : lead.priority === 'MEDIUM' ? 'text-chart-3 border-chart-3/20 bg-chart-3/10' : 'text-primary border-primary/20 bg-primary/10'}`}>
                                {lead.priority} Priority
                            </Badge>
                        )}
                        <Badge variant="outline" className={`text-sm px-3 py-1 font-semibold ${getStageBadgeStyles(lead.pipeline_stage)}`}>
                            {PIPELINE_STAGE_LABELS[lead.pipeline_stage]}
                        </Badge>
                        {(() => {
                            const enrichment = getEnrichmentStatus(lead.enriched_at);
                            return (
                                <Badge variant="outline" className={`font-semibold ${enrichment.style}`}>
                                    {enrichment.label}
                                </Badge>
                            );
                        })()}
                    </div>

                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Composite Score</div>
                        <div className="text-3xl font-bold font-mono tracking-tight text-primary text-shadow-[0_0_8px_rgba(34,197,94,0.4)]">
                            {lead.composite_score || "-"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Meta Row */}
            <div className="mt-8 pt-6 border-t border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">

                {/* Social Presence */}
                <div className="flex flex-wrap items-center gap-3">
                    {(lead.instagram || lead.tiktok || lead.facebook) ? (
                        <>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Social Reach</span>
                            <div className="h-4 w-px bg-border/40 mx-1"></div>
                        </>
                    ) : null}

                    {lead.instagram && (
                        <a href={lead.instagram.startsWith("http") ? lead.instagram : `https://instagram.com/${lead.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer">
                            <Instagram className="h-3.5 w-3.5" />
                            Instagram
                            {lead.instagram_followers != null && (
                                <span className="text-muted-foreground/50 ml-0.5">
                                    ({lead.instagram_followers >= 1000 ? `${(lead.instagram_followers / 1000).toFixed(1)}K` : lead.instagram_followers})
                                </span>
                            )}
                        </a>
                    )}

                    {lead.tiktok && (
                        <a href={lead.tiktok.startsWith("http") ? lead.tiktok : `https://tiktok.com/@${lead.tiktok.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer">
                            <TikTokIcon className="h-3.5 w-3.5" />
                            TikTok
                            {lead.tiktok_followers != null && (
                                <span className="text-muted-foreground/50 ml-0.5">
                                    ({lead.tiktok_followers >= 1000 ? `${(lead.tiktok_followers / 1000).toFixed(1)}K` : lead.tiktok_followers})
                                </span>
                            )}
                        </a>
                    )}

                    {lead.facebook && (
                        <a href={lead.facebook.startsWith("http") ? lead.facebook : `https://facebook.com/${lead.facebook}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer">
                            <Facebook className="h-3.5 w-3.5" />
                            Facebook
                            {lead.facebook_followers != null && (
                                <span className="text-muted-foreground/50 ml-0.5">
                                    ({lead.facebook_followers >= 1000 ? `${(lead.facebook_followers / 1000).toFixed(1)}K` : lead.facebook_followers})
                                </span>
                            )}
                        </a>
                    )}
                </div>

                {/* Ownership */}
                {(lead.owner_name || lead.owner_email) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Owner</span>
                        {lead.owner_name && <span className="font-medium text-foreground">{lead.owner_name}</span>}
                        {lead.owner_name && lead.owner_email && <span>&middot;</span>}
                        {lead.owner_email && <a href={`mailto:${lead.owner_email}`} className="text-primary hover:text-primary/80 transition-colors duration-200 cursor-pointer">{lead.owner_email}</a>}
                    </div>
                )}

            </div>
        </div>
    );
}
