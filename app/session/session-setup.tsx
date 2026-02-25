"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildSessionQueue, type QueueItem } from "@/lib/session-queue-builder";
import type { SessionType, Goals, Lead } from "@/lib/types";

const SESSION_TYPES: {
  value: SessionType;
  label: string;
  icon: string;
  color: string;
  ring: string;
}[] = [
  {
    value: "email",
    label: "Email",
    icon: "\u2709",
    color: "bg-purple-600/20 border-purple-500/40 text-purple-300",
    ring: "ring-purple-500",
  },
  {
    value: "call",
    label: "Call",
    icon: "\u260E",
    color: "bg-blue-600/20 border-blue-500/40 text-blue-300",
    ring: "ring-blue-500",
  },
  {
    value: "dm",
    label: "DM",
    icon: "\u{1F4AC}",
    color: "bg-pink-600/20 border-pink-500/40 text-pink-300",
    ring: "ring-pink-500",
  },
  {
    value: "mixed",
    label: "Mixed",
    icon: "\u{1F504}",
    color: "bg-slate-600/20 border-slate-500/40 text-slate-300",
    ring: "ring-slate-500",
  },
];

const REASON_BADGES: Record<string, { label: string; color: string }> = {
  overdue: { label: "Overdue", color: "bg-red-600 text-red-100" },
  today: { label: "Today", color: "bg-amber-600 text-amber-100" },
  uncontacted: { label: "New", color: "bg-blue-600 text-blue-100" },
};

function dedupeQueueByLead(queue: QueueItem[]): QueueItem[] {
  const seen = new Set<string>();
  const unique: QueueItem[] = [];
  for (const item of queue) {
    if (seen.has(item.leadId)) continue;
    seen.add(item.leadId);
    unique.push(item);
  }
  return unique;
}

interface SessionSetupProps {
  userId: string;
  goals: Goals | null;
}

interface CachedQueue {
  queue: QueueItem[];
  leads: Lead[];
}

export default function SessionSetup({ userId, goals }: SessionSetupProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<SessionType | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());
  const [checkedLeads, setCheckedLeads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchingQueue, setFetchingQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [queueCache, setQueueCache] = useState<
    Partial<Record<SessionType, CachedQueue>>
  >({});

  const handleSelect = useCallback(
    async (type: SessionType) => {
      setSelected(type);
      setError(null);

      const cached = queueCache[type];
      if (cached) {
        setQueueItems(cached.queue);
        setLeadsMap(new Map(cached.leads.map((l) => [l.id, l])));
        setCheckedLeads(new Set(cached.queue.map((q) => q.leadId)));
        return;
      }

      setFetchingQueue(true);

      try {
        const supabase = createClient();

        const [{ data: cadences }, { data: leads }] = await Promise.all([
          supabase
            .from("cadences")
            .select("*")
            .eq("user_id", userId)
            .is("completed_at", null)
            .eq("skipped", false),
          supabase
            .from("leads")
            .select("*")
            .neq("pipeline_stage", "closed_won")
            .neq("pipeline_stage", "closed_lost")
            .neq("pipeline_stage", "dead"),
        ]);

        const queue = dedupeQueueByLead(
          buildSessionQueue(cadences ?? [], leads ?? [], type, userId)
        );

        // Build lead lookup map
        const leadRows = (leads ?? []) as Lead[];
        const map = new Map(leadRows.map((l) => [l.id, l]));
        setLeadsMap(map);
        setQueueItems(queue);
        setQueueCache((prev) => ({ ...prev, [type]: { queue, leads: leadRows } }));

        // All checked by default
        setCheckedLeads(new Set(queue.map((q) => q.leadId)));
      } catch {
        setQueueItems([]);
        setCheckedLeads(new Set());
        setError("Could not load queue. Please try again.");
      } finally {
        setFetchingQueue(false);
      }
    },
    [queueCache, userId]
  );

  const toggleLead = useCallback((leadId: string) => {
    setCheckedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (checkedLeads.size === queueItems.length) {
      setCheckedLeads(new Set());
    } else {
      setCheckedLeads(new Set(queueItems.map((q) => q.leadId)));
    }
  }, [checkedLeads.size, queueItems]);

  const selectedCount = checkedLeads.size;

  const handleStart = useCallback(async () => {
    if (!selected || selectedCount === 0) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Only include checked leads, in queue order
      const queueLeadIds = queueItems
        .filter((q) => checkedLeads.has(q.leadId))
        .map((q) => q.leadId);

      if (queueLeadIds.length === 0) {
        setError("No leads selected.");
        setLoading(false);
        return;
      }

      const sessionInsert = {
        user_id: userId,
        session_type: selected,
        started_at: new Date().toISOString(),
        ended_at: null,
        leads_worked: 0,
        leads_skipped: 0,
        outcomes_summary: {},
        lead_queue: queueLeadIds,
        current_index: 0,
        status: "active" as const,
        streak_best: 0,
        batch_mode: batchMode,
      };

      let { error: insertError } = await supabase
        .from("sessions")
        .insert(sessionInsert);

      // Backward compatibility: some DBs may not yet have `batch_mode`.
      if (
        insertError?.message?.includes("batch_mode") &&
        insertError?.message?.includes("schema cache")
      ) {
        const { batch_mode: _unused, ...legacyInsert } = sessionInsert as typeof sessionInsert & {
          batch_mode?: boolean;
        };
        const retry = await supabase.from("sessions").insert(legacyInsert);
        insertError = retry.error;
      }

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setLoading(false);
    }
  }, [checkedLeads, queueItems, selected, selectedCount, userId, router, batchMode]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-white">Start a Session</h1>
        <p className="mt-2 text-sm text-slate-400">
          Choose your channel, review your queue, and go
        </p>
      </div>

      {/* Session type cards */}
      <div className="grid grid-cols-2 gap-4">
        {SESSION_TYPES.map((st) => (
          <button
            key={st.value}
            onClick={() => handleSelect(st.value)}
            className={`flex flex-col items-center gap-3 rounded-lg border p-4 transition ${
              st.color
            } ${
              selected === st.value ? `ring-2 ${st.ring}` : "hover:opacity-80"
            }`}
          >
            <span className="text-2xl">{st.icon}</span>
            <span className="text-lg font-semibold">{st.label}</span>
          </button>
        ))}
      </div>

      {/* Queue preview with deselect */}
      {selected && !fetchingQueue && queueItems.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="flex h-5 w-5 items-center justify-center rounded border border-slate-500 bg-slate-700 text-xs text-white transition hover:border-slate-400"
              >
                {checkedLeads.size === queueItems.length ? "\u2713" : ""}
              </button>
              <span className="text-sm font-medium text-white">
                {selectedCount} of {queueItems.length} leads selected
              </span>
            </div>
            {goals && (
              <span className="text-xs text-slate-500">
                Goal:{" "}
                {selected === "call"
                  ? goals.calls_per_day
                  : selected === "email"
                  ? goals.emails_per_day
                  : selected === "dm"
                  ? goals.dms_per_day
                  : goals.calls_per_day +
                    goals.emails_per_day +
                    goals.dms_per_day}
                /day
              </span>
            )}
          </div>

          {/* Scrollable lead list */}
          <div className="max-h-72 overflow-y-auto">
            {queueItems.map((item) => {
              const lead = leadsMap.get(item.leadId);
              if (!lead) return null;
              const checked = checkedLeads.has(item.leadId);
              const reasonBadge = REASON_BADGES[item.reason];

              return (
                <button
                  key={item.leadId}
                  onClick={() => toggleLead(item.leadId)}
                  className={`flex w-full items-center gap-3 border-b border-slate-700/50 px-4 py-2.5 text-left transition hover:bg-slate-750 ${
                    !checked ? "opacity-40" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${
                      checked
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-600 bg-slate-800"
                    }`}
                  >
                    {checked ? "\u2713" : ""}
                  </span>

                  {/* Lead info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {lead.name}
                      </span>
                      {lead.priority && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            lead.priority === "HIGH"
                              ? "bg-red-600 text-red-100"
                              : lead.priority === "MEDIUM"
                              ? "bg-yellow-600 text-yellow-100"
                              : "bg-emerald-600 text-emerald-100"
                          }`}
                        >
                          {lead.priority}
                        </span>
                      )}
                      {reasonBadge && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${reasonBadge.color}`}
                        >
                          {reasonBadge.label}
                        </span>
                      )}
                    </div>
                    {lead.category && (
                      <p className="truncate text-xs text-slate-500">
                        {lead.category}
                        {lead.city ? ` \u2022 ${lead.city}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Composite score */}
                  {lead.composite_score != null && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${
                        lead.composite_score >= 70
                          ? "bg-emerald-900/50 text-emerald-400"
                          : lead.composite_score >= 40
                          ? "bg-amber-900/50 text-amber-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {lead.composite_score}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch mode toggle — email and DM only */}
      {selected && (selected === "email" || selected === "dm") && !fetchingQueue && queueItems.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
          <div>
            <span className="text-sm font-medium text-white">Batch Mode</span>
            <p className="text-xs text-slate-400">Generate all messages, review, then rapid-fire</p>
          </div>
          <button
            onClick={() => setBatchMode((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              batchMode ? "bg-blue-600" : "bg-slate-600"
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              batchMode ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
      )}

      {/* Fetching state */}
      {selected && fetchingQueue && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
          <p className="text-sm text-slate-400">Building queue...</p>
        </div>
      )}

      {/* Empty queue */}
      {selected && !fetchingQueue && queueItems.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
          <p className="text-sm text-slate-400">
            No leads in queue for this session type.
          </p>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      {/* Start button */}
      {selected && (
        <button
          onClick={handleStart}
          disabled={loading || selectedCount === 0}
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading
            ? "Starting..."
            : batchMode
            ? `Start Batch Session (${selectedCount} lead${selectedCount !== 1 ? "s" : ""})`
            : `Start Session (${selectedCount} lead${selectedCount !== 1 ? "s" : ""})`}
        </button>
      )}
    </div>
  );
}
