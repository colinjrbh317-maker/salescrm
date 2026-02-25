"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface UnassignedLead {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  composite_score: number | null;
  priority: string | null;
}

interface LeadAssignmentStepProps {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

const STANDARD_OUTREACH_STEPS = [
  { dayOffset: 0, activityType: "cold_call" },
  { dayOffset: 1, activityType: "cold_email" },
  { dayOffset: 3, activityType: "social_dm" },
  { dayOffset: 5, activityType: "follow_up_call" },
  { dayOffset: 7, activityType: "follow_up_email" },
  { dayOffset: 14, activityType: "follow_up_call" },
  { dayOffset: 21, activityType: "walk_in" },
];

export function LeadAssignmentStep({
  userId,
  onNext,
  onBack,
}: LeadAssignmentStepProps) {
  const [leads, setLeads] = useState<UnassignedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState(false);
  const [claimedCount, setClaimedCount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  useEffect(() => {
    async function fetchLeads() {
      const supabase = createClient();
      const { data } = await supabase
        .from("leads")
        .select("id, name, category, city, composite_score, priority")
        .is("assigned_to", null)
        .eq("pipeline_stage", "cold")
        .order("composite_score", { ascending: true })
        .limit(100);

      setLeads(data ?? []);
      setLoading(false);
    }

    fetchLeads();
  }, []);

  // Unique filter values
  const categories = useMemo(
    () => [...new Set(leads.map((l) => l.category).filter(Boolean))] as string[],
    [leads]
  );
  const cities = useMemo(
    () => [...new Set(leads.map((l) => l.city).filter(Boolean))] as string[],
    [leads]
  );

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (categoryFilter && lead.category !== categoryFilter) return false;
      if (cityFilter && lead.city !== cityFilter) return false;
      return true;
    });
  }, [leads, categoryFilter, cityFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredLeads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLeads.map((l) => l.id)));
    }
  }

  async function claimSingle(leadId: string) {
    setClaiming(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: userId })
      .eq("id", leadId);

    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      setClaimedCount((prev) => prev + 1);
    }
    setClaiming(false);
  }

  async function claimSelected() {
    if (selected.size === 0) return;

    setClaiming(true);
    const supabase = createClient();
    const selectedIds = Array.from(selected);

    // Claim all selected leads
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: userId })
      .in("id", selectedIds);

    if (error) {
      setClaiming(false);
      return;
    }

    // Get top 5 claimed leads by composite_score for cadence auto-start
    const claimedLeads = leads
      .filter((l) => selectedIds.includes(l.id))
      .sort((a, b) => (a.composite_score ?? 999) - (b.composite_score ?? 999))
      .slice(0, 5);

    // Auto-start Standard Outreach cadence on top 5
    const now = new Date();
    const cadenceRows = claimedLeads.flatMap((lead) =>
      STANDARD_OUTREACH_STEPS.map((step, index) => {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);
        return {
          lead_id: lead.id,
          user_id: userId,
          step_number: index + 1,
          channel: step.activityType,
          scheduled_at: scheduledDate.toISOString(),
          completed_at: null,
          skipped: false,
        };
      })
    );

    if (cadenceRows.length > 0) {
      await supabase.from("cadences").insert(cadenceRows);
    }

    setClaimedCount((prev) => prev + selectedIds.length);
    setLeads((prev) => prev.filter((l) => !selectedIds.includes(l.id)));
    setSelected(new Set());
    setClaiming(false);
  }

  const PRIORITY_COLORS: Record<string, string> = {
    HIGH: "bg-red-900/50 text-red-400 border-red-700",
    MEDIUM: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
    LOW: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-8">
      <h2 className="mb-2 text-2xl font-bold text-white">Claim Your Leads</h2>
      <p className="mb-2 text-slate-300">
        Pick the leads you want to work. The top 5 you claim will automatically
        get a Standard Outreach cadence started.
      </p>
      {claimedCount > 0 && (
        <p className="mb-4 text-sm text-emerald-400">
          {claimedCount} lead{claimedCount !== 1 ? "s" : ""} claimed so far!
        </p>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {selected.size > 0 && (
          <button
            onClick={claimSelected}
            disabled={claiming}
            className="ml-auto rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {claiming
              ? "Claiming..."
              : `Claim Selected (${selected.size})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <p className="py-8 text-center text-slate-400">
          {leads.length === 0
            ? "No unclaimed leads available right now."
            : "No leads match the current filters."}
        </p>
      ) : (
        <div className="mb-6 max-h-96 space-y-2 overflow-y-auto">
          {/* Select all */}
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-600 bg-slate-700/50 px-4 py-2">
            <input
              type="checkbox"
              checked={selected.size === filteredLeads.length && filteredLeads.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-xs font-medium text-slate-400">
              Select All ({filteredLeads.length})
            </span>
          </label>

          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-700 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={selected.has(lead.id)}
                onChange={() => toggleSelect(lead.id)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {lead.name}
                </p>
                <div className="flex gap-2 text-xs text-slate-400">
                  {lead.category && <span>{lead.category}</span>}
                  {lead.category && lead.city && <span>-</span>}
                  {lead.city && <span>{lead.city}</span>}
                </div>
              </div>

              {lead.priority && (
                <span
                  className={`rounded border px-2 py-0.5 text-xs ${
                    PRIORITY_COLORS[lead.priority] ?? "bg-slate-600 text-slate-300 border-slate-500"
                  }`}
                >
                  {lead.priority}
                </span>
              )}

              {lead.composite_score !== null && (
                <span className="text-xs text-slate-400">
                  Score: {lead.composite_score}
                </span>
              )}

              <button
                onClick={() => claimSingle(lead.id)}
                disabled={claiming}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                Claim
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {claimedCount > 0 ? "Next" : "Skip for Now"}
        </button>
      </div>
    </div>
  );
}
