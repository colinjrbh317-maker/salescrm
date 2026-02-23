"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadNote, LeadType, PipelineStage } from "@/lib/types";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  PRIORITY_COLORS,
  LEAD_TYPE_LABELS,
  LEAD_TYPE_COLORS,
  LEAD_TYPES,
  PIPELINE_STAGES,
} from "@/lib/types";

type Tab = "my" | "unassigned" | "all";

interface LeadQueueProps {
  leads: Lead[];
  currentUserId: string;
  teamMembers?: { id: string; full_name: string | null }[];
  userRole?: string;
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Badge({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function LeadQueue({ leads, currentUserId, teamMembers = [], userRole }: LeadQueueProps) {
  const [activeTab, setActiveTab] = useState<Tab>("my");
  const [search, setSearch] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
  } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Filters
  const [filterType, setFilterType] = useState<LeadType | "">("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStage, setFilterStage] = useState<PipelineStage | "">("");
  const [filterChannel, setFilterChannel] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Unique values for filter dropdowns
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    leads.forEach((l) => { if (l.category) cats.add(l.category); });
    return Array.from(cats).sort();
  }, [leads]);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    leads.forEach((l) => { if (l.city) cities.add(l.city); });
    return Array.from(cities).sort();
  }, [leads]);

  const uniquePriorities = useMemo(() => {
    const pris = new Set<string>();
    leads.forEach((l) => { if (l.priority) pris.add(l.priority); });
    return Array.from(pris).sort();
  }, [leads]);

  const activeFilterCount = [filterType, filterCategory, filterCity, filterPriority, filterStage, filterChannel].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterType("");
    setFilterCategory("");
    setFilterCity("");
    setFilterPriority("");
    setFilterStage("");
    setFilterChannel("");
  };

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

    // Column filters
    if (filterType) filtered = filtered.filter((l) => l.lead_type === filterType);
    if (filterCategory) filtered = filtered.filter((l) => l.category === filterCategory);
    if (filterCity) filtered = filtered.filter((l) => l.city === filterCity);
    if (filterPriority) filtered = filtered.filter((l) => l.priority === filterPriority);
    if (filterStage) filtered = filtered.filter((l) => l.pipeline_stage === filterStage);
    if (filterChannel) filtered = filtered.filter((l) => l.ai_channel_rec === filterChannel);

    return filtered;
  }, [leads, activeTab, search, currentUserId, filterType, filterCategory, filterCity, filterPriority, filterStage, filterChannel]);

  // Team member lookup
  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) {
      map[m.id] = m.full_name ?? "Unknown";
    }
    return map;
  }, [teamMembers]);

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  }, [filteredLeads, selectedIds.size]);

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds]
  );

  // Bulk actions (enrich + re-enrich)
  async function handleBulkEnrich() {
    const toEnrich = [...selectedLeads];
    if (toEnrich.length === 0) return;

    setEnriching(true);
    setEnrichError(null);
    setEnrichProgress({ current: 0, total: toEnrich.length, currentName: toEnrich[0].name });

    for (let i = 0; i < toEnrich.length; i++) {
      const lead = toEnrich[i];
      setEnrichProgress({ current: i, total: toEnrich.length, currentName: lead.name });

      try {
        const response = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: [lead.id] }),
        });

        if (!response.ok) {
          const err = await response.json();
          if (err.error?.includes("ANTHROPIC_API_KEY")) {
            setEnrichError("Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env.local and restart the server.");
            setEnriching(false);
            setEnrichProgress(null);
            return;
          }
          console.error(`[Enrich] Failed for ${lead.name}:`, err.error);
        }
      } catch (error) {
        console.error(`[Enrich] Network error for ${lead.name}:`, error);
      }
    }

    setEnrichProgress(null);
    setEnriching(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleBulkDelete() {
    setDeleting(true);
    try {
      const response = await fetch("/api/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      if (!response.ok) {
        const err = await response.json();
        console.error("[Delete] API error:", err.error);
      }
    } catch (error) {
      console.error("[Delete] Failed:", error);
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleBulkNote() {
    if (!noteText.trim()) return;

    const currentMember = teamMembers.find((m) => m.id === currentUserId);
    const newNote: LeadNote = {
      id: crypto.randomUUID(),
      text: noteText.trim(),
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      user_name: currentMember?.full_name ?? "Unknown",
    };

    for (const lead of selectedLeads) {
      const existing: LeadNote[] = (lead.notes as LeadNote[] | null) ?? [];
      await supabase
        .from("leads")
        .update({ notes: [...existing, newNote] })
        .eq("id", lead.id);
    }

    setNoteText("");
    setShowNoteModal(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleBulkAssign(assignToId: string) {
    for (const id of selectedIds) {
      await supabase
        .from("leads")
        .update({ assigned_to: assignToId })
        .eq("id", id);
    }
    setShowAssignModal(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleClaim(leadId: string) {
    setClaimingId(leadId);
    await supabase
      .from("leads")
      .update({ assigned_to: currentUserId })
      .eq("id", leadId);
    router.refresh();
    setClaimingId(null);
  }

  async function handleAutoAssign() {
    if (teamMembers.length === 0) return;
    setAutoAssigning(true);

    const unassigned = leads.filter((l) => !l.assigned_to);
    for (let i = 0; i < unassigned.length; i++) {
      const assignTo = teamMembers[i % teamMembers.length].id;
      await supabase
        .from("leads")
        .update({ assigned_to: assignTo })
        .eq("id", unassigned[i].id);
    }

    setAutoAssigning(false);
    router.refresh();
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    {
      key: "my",
      label: "My Leads",
      count: leads.filter((l) => l.assigned_to === currentUserId).length,
    },
    {
      key: "unassigned",
      label: "Unassigned",
      count: leads.filter((l) => !l.assigned_to).length,
    },
    {
      key: "all",
      label: "All",
      count: leads.length,
    },
  ];

  // Count enrichment status for button label
  const alreadyEnrichedCount = selectedLeads.filter((l) => l.enriched_at).length;
  const unenrichedCount = selectedIds.size - alreadyEnrichedCount;
  const enrichButtonLabel = enriching
    ? "Enriching..."
    : alreadyEnrichedCount === selectedIds.size
    ? "Re-Enrich"
    : unenrichedCount === selectedIds.size
    ? "Enrich"
    : `Enrich (${unenrichedCount} new, ${alreadyEnrichedCount} re-enrich)`;

  return (
    <div>
      {/* Unified Toolbar */}
      <div className="mb-3 flex h-12 items-center gap-3">
        <h1 className="text-lg font-semibold text-white">Leads</h1>

        {/* Tab pills */}
        <div className="flex items-center gap-1 rounded-md bg-slate-800 p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab.label}
              <span className="text-[10px] opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        {/* Filter button */}
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activeFilterCount > 0
                ? "border-emerald-600 bg-emerald-900/30 text-emerald-300"
                : "border-slate-600 bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Filter popover */}
          {showFilters && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowFilters(false)} />
              <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Filters</span>
                  {activeFilterCount > 0 && (
                    <button onClick={clearAllFilters} className="text-xs text-slate-500 hover:text-white">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value as LeadType | "")} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none">
                    <option value="">All Types</option>
                    {LEAD_TYPES.map((t) => (<option key={t} value={t}>{LEAD_TYPE_LABELS[t]}</option>))}
                  </select>
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none">
                    <option value="">All Categories</option>
                    {uniqueCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none">
                    <option value="">All Cities</option>
                    {uniqueCities.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none">
                    <option value="">All Priorities</option>
                    {uniquePriorities.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                  <select value={filterStage} onChange={(e) => setFilterStage(e.target.value as PipelineStage | "")} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none">
                    <option value="">All Stages</option>
                    {PIPELINE_STAGES.map((s) => (<option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>))}
                  </select>
                  <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none">
                    <option value="">All Channels</option>
                    <option value="cold_call">Call Recommended</option>
                    <option value="cold_email">Email Recommended</option>
                    <option value="social_dm">DM Recommended</option>
                    <option value="walk_in">Walk-in Recommended</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        {(userRole === "admin") && teamMembers.length > 0 && leads.some((l) => !l.assigned_to) && (
          <button
            onClick={handleAutoAssign}
            disabled={autoAssigning}
            className="whitespace-nowrap rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {autoAssigning ? "..." : `Auto-Assign`}
          </button>
        )}

        <button
          onClick={() => router.push("/leads/new")}
          className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Lead
        </button>
      </div>


      {/* Enrichment Progress Bar */}
      {enrichProgress && (
        <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-emerald-300">
              Enriching {enrichProgress.current + 1} of {enrichProgress.total}
              <span className="ml-2 text-emerald-400/70">— {enrichProgress.currentName}</span>
            </span>
            <span className="text-emerald-400/70 text-xs">
              {Math.round(((enrichProgress.current) / enrichProgress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-900/50">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Enrichment Error Banner */}
      {enrichError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3">
          <svg className="h-5 w-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span className="text-sm text-red-300">{enrichError}</span>
          <button
            onClick={() => setEnrichError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 p-3">
          <span className="mr-2 text-sm font-medium text-slate-300">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkEnrich}
            disabled={enriching}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            title="Enrich or re-enrich selected leads"
          >
            {enrichButtonLabel}
          </button>
          <button
            onClick={() => setShowNoteModal(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            Add Note
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700"
          >
            Assign
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto rounded-md px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
              </th>
              <th className="px-3 py-2.5 text-xs font-medium text-slate-400">Lead</th>
              <th className="px-3 py-2.5 text-xs font-medium text-slate-400">Priority</th>
              <th className="px-3 py-2.5 text-xs font-medium text-slate-400">Stage</th>
              <th className="px-3 py-2.5 text-xs font-medium text-slate-400">Score</th>
              <th className="px-3 py-2.5 text-xs font-medium text-slate-400">Last Activity</th>
              {activeTab === "unassigned" && (
                <th className="px-3 py-2.5 text-xs font-medium text-slate-400">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td
                  colSpan={activeTab === "unassigned" ? 7 : 6}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  {search
                    ? "No leads match your search"
                    : activeTab === "my"
                    ? "No leads assigned to you yet. Check the Unassigned tab to claim leads."
                    : "No leads found"}
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className={`cursor-pointer border-b border-slate-700/50 transition-colors hover:bg-slate-800/50 ${
                    selectedIds.has(lead.id) ? "bg-slate-800/70" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white">{lead.name}</span>
                          {lead.enriched_at && (
                            <svg className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-label="Enriched">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge label={LEAD_TYPE_LABELS[lead.lead_type] ?? "Business"} colorClass={LEAD_TYPE_COLORS[lead.lead_type] ?? "bg-blue-600 text-blue-100"} />
                          {lead.city && <span className="text-xs text-slate-500">{lead.city}</span>}
                        </div>
                      </div>
                      {lead.assigned_to && teamMemberMap[lead.assigned_to] && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white" title={teamMemberMap[lead.assigned_to]}>
                          {getInitials(teamMemberMap[lead.assigned_to])}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {lead.priority ? (
                      <Badge label={lead.priority} colorClass={PRIORITY_COLORS[lead.priority] ?? "bg-slate-600 text-slate-200"} />
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge label={PIPELINE_STAGE_LABELS[lead.pipeline_stage]} colorClass={PIPELINE_STAGE_COLORS[lead.pipeline_stage]} />
                  </td>
                  <td className="px-3 py-2.5">
                    {lead.composite_score != null ? (
                      <span className={`font-mono text-xs ${lead.composite_score <= 30 ? "text-red-400" : lead.composite_score <= 60 ? "text-yellow-400" : "text-emerald-400"}`}>
                        {lead.composite_score}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-xs text-slate-400">{formatDate(lead.last_contacted_at)}</div>
                    {lead.next_followup_at && (
                      <div className="text-[10px] text-slate-500">Next: {formatDate(lead.next_followup_at)}</div>
                    )}
                  </td>
                  {activeTab === "unassigned" && (
                    <td className="px-3 py-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaim(lead.id);
                        }}
                        disabled={claimingId === lead.id}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        {claimingId === lead.id ? "Claiming..." : "Claim"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Count */}
      <p className="mt-3 text-xs text-slate-500">
        Showing {filteredLeads.length} of {leads.length} leads
      </p>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white">Delete Leads</h3>
            <p className="mt-2 text-sm text-slate-400">
              Are you sure you want to permanently delete{" "}
              <span className="font-medium text-white">{selectedIds.size}</span>{" "}
              lead{selectedIds.size > 1 ? "s" : ""}? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white">
              Add Note to {selectedIds.size} Lead{selectedIds.size > 1 ? "s" : ""}
            </h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g., Pitched web design services in 2024..."
              rows={3}
              className="mt-3 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteText("");
                }}
                className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkNote}
                disabled={!noteText.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white">
              Assign {selectedIds.size} Lead{selectedIds.size > 1 ? "s" : ""}
            </h3>
            <div className="mt-3 space-y-2">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleBulkAssign(member.id)}
                  className="flex w-full items-center gap-3 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-left text-sm text-white transition-colors hover:border-blue-500 hover:bg-slate-600"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {getInitials(member.full_name)}
                  </span>
                  <span>{member.full_name ?? "Unknown"}</span>
                  {member.id === currentUserId && (
                    <span className="ml-auto text-xs text-slate-400">(you)</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
