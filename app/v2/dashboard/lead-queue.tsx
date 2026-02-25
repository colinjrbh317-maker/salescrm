"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadType, PipelineStage } from "@/lib/types";
import {
    PIPELINE_STAGE_LABELS,
    LEAD_TYPE_LABELS,
} from "@/lib/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Building2, UserCircle2 } from "lucide-react";

type Tab = "my" | "unassigned" | "all";

interface LeadQueueProps {
    leads: Lead[];
    currentUserId: string;
}

function formatDate(date: string | null): string {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

function getScoreColor(score: number | null) {
    if (score === null) return "text-muted-foreground";
    if (score <= 30) return "text-destructive font-semibold";
    if (score <= 60) return "text-chart-3 font-semibold";
    return "text-primary font-semibold text-shadow-[0_0_8px_rgba(34,197,94,0.4)]";
}

function getStageBadgeStyles(stage: PipelineStage): string {
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

export function LeadQueue({ leads, currentUserId }: LeadQueueProps) {
    const [activeTab, setActiveTab] = useState<Tab>("my");
    const [search, setSearch] = useState("");
    const router = useRouter();

    const filteredLeads = useMemo(() => {
        let filtered = leads;

        // Tab filter
        if (activeTab === "my") {
            filtered = filtered.filter((l) => l.assigned_to === currentUserId);
        } else if (activeTab === "unassigned") {
            filtered = filtered.filter((l) => !l.assigned_to);
        }

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter(
                (l) =>
                    l.name?.toLowerCase().includes(q) ||
                    l.city?.toLowerCase().includes(q) ||
                    l.category?.toLowerCase().includes(q)
            );
        }

        return filtered;
    }, [leads, activeTab, search, currentUserId]);

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: "my", label: "My Leads", count: leads.filter((l) => l.assigned_to === currentUserId).length },
        { key: "unassigned", label: "Unclaimed", count: leads.filter((l) => !l.assigned_to).length },
        { key: "all", label: "All Database", count: leads.length },
    ];

    return (
        <div className="space-y-6">

            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex bg-secondary p-1 rounded-xl border border-border/40">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all active:scale-[0.98] cursor-pointer ${activeTab === tab.key
                                ? "bg-background text-foreground shadow-sm border border-border/40"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {tab.label}
                            <span
                                className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${activeTab === tab.key
                                    ? "bg-primary/20 text-primary border border-primary/30"
                                    : "bg-background/40 text-muted-foreground"
                                    }`}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search leads, cities, categories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-full sm:w-80 bg-background rounded-xl border-border/40 focus-visible:ring-primary shadow-sm text-foreground placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-card rounded-2xl border border-border/40 shadow-md shadow-black/20 overflow-hidden backdrop-blur-sm">
                <Table>
                    <TableHeader className="bg-secondary/50 border-b border-border/40">
                        <TableRow className="hover:bg-transparent border-0">
                            <TableHead className="w-[300px] font-semibold text-muted-foreground uppercase text-xs tracking-wider">Company / Contact</TableHead>
                            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Location</TableHead>
                            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Stage</TableHead>
                            <TableHead className="text-right font-semibold text-muted-foreground uppercase text-xs tracking-wider">Score</TableHead>
                            <TableHead className="text-right font-semibold text-muted-foreground uppercase text-xs tracking-wider">Last Touch</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLeads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    No leads found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLeads.map((lead) => (
                                <TableRow
                                    key={lead.id}
                                    onClick={() => router.push(`/v2/leads/${lead.id}`)}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors duration-200 group border-b border-border/40"
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-secondary border border-border/60 flex items-center justify-center flex-shrink-0 text-muted-foreground group-hover:bg-background group-hover:text-primary transition-all duration-200 shadow-sm">
                                                {lead.lead_type === 'creator' || lead.lead_type === 'podcast' ? <UserCircle2 className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground flex items-center gap-2">
                                                    {lead.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono mt-0.5">{lead.category || LEAD_TYPE_LABELS[lead.lead_type]}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {lead.city ? (
                                            <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground/50" />
                                                {lead.city}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground/30">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`font-semibold py-0.5 border bg-transparent ${getStageBadgeStyles(lead.pipeline_stage)}`}>
                                            {PIPELINE_STAGE_LABELS[lead.pipeline_stage]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className={`font-mono text-base ${getScoreColor(lead.composite_score)}`}>
                                            {lead.composite_score ?? "-"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-sm font-medium">
                                        {formatDate(lead.last_contacted_at)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
