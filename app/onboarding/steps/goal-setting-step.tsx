"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface GoalSettingStepProps {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

interface GoalField {
  key: string;
  label: string;
  defaultValue: number;
  suffix: string;
}

const GOAL_FIELDS: GoalField[] = [
  { key: "calls_per_day", label: "Calls per Day", defaultValue: 15, suffix: "calls/day" },
  { key: "emails_per_day", label: "Emails per Day", defaultValue: 20, suffix: "emails/day" },
  { key: "dms_per_day", label: "DMs per Day", defaultValue: 10, suffix: "DMs/day" },
  { key: "deals_per_month", label: "Deals per Month", defaultValue: 4, suffix: "deals/month" },
  { key: "revenue_target", label: "Revenue Target", defaultValue: 10000, suffix: "$/month" },
];

export function GoalSettingStep({ userId, onNext, onBack }: GoalSettingStepProps) {
  const [goals, setGoals] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    GOAL_FIELDS.forEach((f) => {
      initial[f.key] = f.defaultValue;
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateGoal(key: string, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setGoals((prev) => ({ ...prev, [key]: num }));
    }
  }

  async function handleNext() {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ goals })
      .eq("id", userId);

    if (updateError) {
      setError("Failed to save goals. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onNext();
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-8">
      <h2 className="mb-2 text-2xl font-bold text-white">Set Your Goals</h2>
      <p className="mb-8 text-slate-300">
        Set daily and monthly targets to keep yourself on track. You can always
        adjust these later.
      </p>

      <div className="mb-8 space-y-4">
        {GOAL_FIELDS.map((field) => (
          <div key={field.key}>
            <label
              htmlFor={field.key}
              className="mb-1.5 block text-sm font-medium text-slate-400"
            >
              {field.label}
            </label>
            <div className="flex items-center gap-3">
              <input
                id={field.key}
                type="number"
                min={0}
                value={goals[field.key]}
                onChange={(e) => updateGoal(field.key, e.target.value)}
                className="w-32 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400">{field.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mb-8 rounded-lg border border-slate-600 bg-slate-700/50 p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">Daily Activity Target</h3>
        <p className="text-2xl font-bold text-white">
          {(goals.calls_per_day ?? 0) + (goals.emails_per_day ?? 0) + (goals.dms_per_day ?? 0)}
        </p>
        <p className="text-xs text-slate-400">total touches per day</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-900/50 px-3 py-2 text-sm text-red-300">
          {error}
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
          onClick={handleNext}
          disabled={saving}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Next"}
        </button>
      </div>
    </div>
  );
}
