"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const OUTREACH_CHANNELS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "instagram_dm", label: "Instagram DM" },
  { value: "tiktok_dm", label: "TikTok DM" },
  { value: "facebook_dm", label: "Facebook DM" },
];

interface WelcomeStepProps {
  profile: Profile | null;
  userId: string;
  onNext: () => void;
}

export function WelcomeStep({ profile, userId, onNext }: WelcomeStepProps) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    profile?.preferred_channels ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(channel: string) {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  }

  async function handleNext() {
    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        preferred_channels: selectedChannels,
      })
      .eq("id", userId);

    if (updateError) {
      setError("Failed to save. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onNext();
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-8">
      <h2 className="mb-2 text-2xl font-bold text-white">
        Welcome to Sales CRM
      </h2>
      <p className="mb-8 text-slate-300">
        Let us get to know you. This helps us personalize your experience and
        set you up for success.
      </p>

      {/* Full Name */}
      <div className="mb-6">
        <label
          htmlFor="fullName"
          className="mb-2 block text-sm font-medium text-slate-400"
        >
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Your full name"
        />
      </div>

      {/* Preferred Outreach Channels */}
      <div className="mb-8">
        <label className="mb-3 block text-sm font-medium text-slate-400">
          Preferred Outreach Channels
        </label>
        <div className="space-y-2">
          {OUTREACH_CHANNELS.map((channel) => (
            <label
              key={channel.value}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-600 bg-slate-700 px-4 py-3 transition-colors hover:border-slate-500"
            >
              <input
                type="checkbox"
                checked={selectedChannels.includes(channel.value)}
                onChange={() => toggleChannel(channel.value)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-white">{channel.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-900/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleNext}
        disabled={saving}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Next"}
      </button>
    </div>
  );
}
