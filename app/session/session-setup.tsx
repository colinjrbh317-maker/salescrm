"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildSessionQueue } from "@/lib/session-queue-builder";
import type { SessionType, Goals } from "@/lib/types";

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

interface SessionSetupProps {
  userId: string;
  goals: Goals | null;
}

export default function SessionSetup({ userId, goals }: SessionSetupProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<SessionType | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (type: SessionType) => {
      setSelected(type);
      setError(null);

      const supabase = createClient();

      // Fetch cadences and leads to preview queue size
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

      const queue = buildSessionQueue(
        cadences ?? [],
        leads ?? [],
        type,
        userId
      );
      setQueueCount(queue.length);
    },
    [userId]
  );

  const handleStart = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);

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

      const queue = buildSessionQueue(
        cadences ?? [],
        leads ?? [],
        selected,
        userId
      );

      if (queue.length === 0) {
        setError("No leads in queue for this session type.");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from("sessions").insert({
        user_id: userId,
        session_type: selected,
        started_at: new Date().toISOString(),
        ended_at: null,
        leads_worked: 0,
        leads_skipped: 0,
        outcomes_summary: {},
        lead_queue: queue.map((q) => q.leadId),
        current_index: 0,
        status: "active" as const,
        streak_best: 0,
      });

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
  }, [selected, userId, router]);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Start a Session</h1>
        <p className="mt-2 text-sm text-slate-400">
          Choose your session type to build a lead queue
        </p>
      </div>

      {/* Session type cards */}
      <div className="grid grid-cols-2 gap-4">
        {SESSION_TYPES.map((st) => (
          <button
            key={st.value}
            onClick={() => handleSelect(st.value)}
            className={`flex flex-col items-center gap-3 rounded-lg border p-6 transition ${
              st.color
            } ${
              selected === st.value ? `ring-2 ${st.ring}` : "hover:opacity-80"
            }`}
          >
            <span className="text-3xl">{st.icon}</span>
            <span className="text-lg font-semibold">{st.label}</span>
          </button>
        ))}
      </div>

      {/* Queue preview */}
      {selected && queueCount !== null && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center">
          <p className="text-sm text-slate-400">Queue preview</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {queueCount} lead{queueCount !== 1 ? "s" : ""}
          </p>
          {goals && (
            <p className="mt-1 text-xs text-slate-500">
              Daily goal:{" "}
              {selected === "call"
                ? goals.calls_per_day
                : selected === "email"
                ? goals.emails_per_day
                : selected === "dm"
                ? goals.dms_per_day
                : goals.calls_per_day +
                  goals.emails_per_day +
                  goals.dms_per_day}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      {/* Start button */}
      {selected && (
        <button
          onClick={handleStart}
          disabled={loading || queueCount === 0}
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start Session"}
        </button>
      )}
    </div>
  );
}
