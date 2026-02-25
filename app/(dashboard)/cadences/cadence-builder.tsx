"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// Channel Options
// ============================================================

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "cold_call", label: "Phone Call" },
  { value: "cold_email", label: "Email" },
  { value: "social_dm", label: "Instagram/Facebook/TikTok DM" },
  { value: "follow_up_call", label: "Follow-up Call" },
  { value: "follow_up_email", label: "Follow-up Email" },
  { value: "walk_in", label: "Walk-in" },
];

// ============================================================
// Types
// ============================================================

interface CadenceBuilderProps {
  leadId: string;
  userId: string;
  onSave: () => void;
  onCancel: () => void;
}

interface BuilderStep {
  id: string;
  channel: string;
  dayOffset: number;
}

// ============================================================
// Helper: add business days (skip weekends)
// ============================================================

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  return result;
}

// ============================================================
// Component
// ============================================================

export function CadenceBuilder({
  leadId,
  userId,
  onSave,
  onCancel,
}: CadenceBuilderProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<BuilderStep[]>([
    { id: crypto.randomUUID(), channel: "cold_call", dayOffset: 0 },
    { id: crypto.randomUUID(), channel: "cold_email", dayOffset: 2 },
    { id: crypto.randomUUID(), channel: "social_dm", dayOffset: 5 },
  ]);

  // ----------------------------------------------------------
  // Step mutations
  // ----------------------------------------------------------

  function addStep() {
    const lastOffset = steps.length > 0 ? steps[steps.length - 1].dayOffset : 0;
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        channel: "cold_call",
        dayOffset: lastOffset + 3,
      },
    ]);
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function updateChannel(id: string, channel: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, channel } : s))
    );
  }

  function updateDayOffset(id: string, dayOffset: number) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, dayOffset } : s))
    );
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (index >= steps.length - 1) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  async function handleSave() {
    if (steps.length === 0) {
      setError("Add at least one step before saving.");
      setTimeout(() => setError(null), 4000);
      return;
    }

    setSaving(true);
    setError(null);

    const now = new Date();
    const rows = steps.map((step, index) => ({
      lead_id: leadId,
      user_id: userId,
      step_number: index + 1,
      channel: step.channel,
      scheduled_at: addBusinessDays(now, step.dayOffset).toISOString(),
      completed_at: null,
      skipped: false,
    }));

    const { error: insertError } = await supabase.from("cadences").insert(rows);

    if (insertError) {
      setError("Failed to save cadence. Please try again.");
      setTimeout(() => setError(null), 5000);
    } else {
      onSave();
    }

    setSaving(false);
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Build Custom Cadence
      </h3>

      {error && (
        <div className="mb-3 rounded-md border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-750 p-3"
          >
            {/* Step number */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-300">
              {index + 1}
            </div>

            {/* Channel selector */}
            <select
              value={step.channel}
              onChange={(e) => updateChannel(step.id, e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Day offset */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-400">Day</label>
              <input
                type="number"
                min={0}
                max={90}
                value={step.dayOffset}
                onChange={(e) =>
                  updateDayOffset(step.id, Math.max(0, Math.min(90, parseInt(e.target.value) || 0)))
                }
                className="w-16 rounded-md border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Reorder buttons */}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="Move up"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === steps.length - 1}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="Move down"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Delete */}
              <button
                onClick={() => removeStep(step.id)}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-red-900/50 hover:text-red-400"
                title="Remove step"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Step */}
      <button
        onClick={addStep}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 py-2.5 text-sm text-slate-400 transition hover:border-slate-500 hover:text-slate-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Step
      </button>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || steps.length === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Cadence"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
