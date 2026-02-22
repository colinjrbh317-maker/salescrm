"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import { CadenceStepCard } from "./cadence-step-card";

// ============================================================
// Types for cadence with joined lead data
// ============================================================

export interface CadenceWithLead {
  id: string;
  created_at: string;
  lead_id: string;
  user_id: string;
  step_number: number;
  channel: string;
  scheduled_at: string;
  completed_at: string | null;
  skipped: boolean;
  script_id: string | null;
  template_name: string | null;
  leads: {
    id: string;
    name: string;
    category: string | null;
    city: string | null;
  };
}

export interface TeamProfile {
  id: string;
  full_name: string | null;
}

// ============================================================
// Channel filter tabs
// ============================================================

type FilterTab = "all" | "email" | "call" | "dm" | "walk_in";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "email", label: "Email" },
  { key: "call", label: "Call" },
  { key: "dm", label: "DM" },
  { key: "walk_in", label: "Walk-in" },
];

const FILTER_ACTIVITY_MAP: Record<string, ActivityType[]> = {
  email: ["cold_email", "follow_up_email"],
  call: ["cold_call", "follow_up_call"],
  dm: ["social_dm"],
  walk_in: ["walk_in"],
};

// ============================================================
// Time bucket helpers
// ============================================================

type TimeBucket = "overdue" | "today" | "tomorrow" | "this_week";

const BUCKET_CONFIG: Record<
  TimeBucket,
  { label: string; colorClass: string; icon: string }
> = {
  overdue: { label: "Overdue", colorClass: "text-red-400", icon: "!" },
  today: { label: "Today", colorClass: "text-amber-400", icon: "" },
  tomorrow: { label: "Tomorrow", colorClass: "text-blue-400", icon: "" },
  this_week: { label: "This Week", colorClass: "text-slate-400", icon: "" },
};

function getTimeBucket(scheduledAt: string): TimeBucket | null {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrow = new Date(todayStart);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  // End of the current week (Sunday end)
  const dayOfWeek = todayStart.getDay(); // 0=Sun
  const endOfWeek = new Date(todayStart);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));

  const scheduled = new Date(scheduledAt);

  if (scheduled < todayStart) return "overdue";
  if (scheduled < tomorrowStart) return "today";
  if (scheduled < dayAfterTomorrow) return "tomorrow";
  if (scheduled < endOfWeek) return "this_week";
  // Beyond this week - still show in this_week as a catch-all
  return "this_week";
}

// ============================================================
// Component
// ============================================================

interface CadenceHubProps {
  cadences: CadenceWithLead[];
  currentUserId: string;
  teamProfiles: TeamProfile[];
}

export function CadenceHub({
  cadences,
  currentUserId,
  teamProfiles,
}: CadenceHubProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);

  const isViewingOwn = selectedUserId === currentUserId;

  // Filter by selected team member
  const userCadences = useMemo(() => {
    return cadences.filter((c) => c.user_id === selectedUserId);
  }, [cadences, selectedUserId]);

  // Filter by channel tab
  const filtered = useMemo(() => {
    if (activeFilter === "all") return userCadences;
    const allowedTypes = FILTER_ACTIVITY_MAP[activeFilter] ?? [];
    return userCadences.filter((c) =>
      allowedTypes.includes(c.channel as ActivityType)
    );
  }, [userCadences, activeFilter]);

  // Group into time buckets
  const buckets = useMemo(() => {
    const groups: Record<TimeBucket, CadenceWithLead[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      this_week: [],
    };

    for (const cadence of filtered) {
      const bucket = getTimeBucket(cadence.scheduled_at);
      if (bucket) {
        groups[bucket].push(cadence);
      }
    }

    return groups;
  }, [filtered]);

  const bucketOrder: TimeBucket[] = [
    "overdue",
    "today",
    "tomorrow",
    "this_week",
  ];

  // Only show team members who actually have cadences
  const membersWithCadences = useMemo(() => {
    const userIds = new Set(cadences.map((c) => c.user_id));
    return teamProfiles.filter((p) => userIds.has(p.id));
  }, [cadences, teamProfiles]);

  const selectedName =
    teamProfiles.find((p) => p.id === selectedUserId)?.full_name ?? "Unknown";

  return (
    <div className="space-y-6">
      {/* Team member selector */}
      {membersWithCadences.length > 1 && (
        <div className="flex items-center gap-3">
          <label
            htmlFor="team-member-select"
            className="text-sm font-medium text-slate-400"
          >
            Viewing:
          </label>
          <select
            id="team-member-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {membersWithCadences.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.id === currentUserId
                  ? `My Cadences`
                  : profile.full_name ?? "Unknown"}
              </option>
            ))}
          </select>
          {!isViewingOwn && (
            <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs text-slate-400">
              Read-only
            </span>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-12 text-center">
          <p className="text-sm text-slate-400">
            {isViewingOwn
              ? `No pending cadence steps${activeFilter !== "all" ? " for this channel" : ""}. Start a cadence from a lead's detail page.`
              : `${selectedName} has no pending cadence steps${activeFilter !== "all" ? " for this channel" : ""}.`}
          </p>
        </div>
      )}

      {/* Time buckets */}
      {bucketOrder.map((bucketKey) => {
        const items = buckets[bucketKey];
        if (items.length === 0) return null;

        const config = BUCKET_CONFIG[bucketKey];

        return (
          <div key={bucketKey}>
            {/* Bucket header */}
            <div className="mb-3 flex items-center gap-2">
              {bucketKey === "overdue" && (
                <svg
                  className="h-4 w-4 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              )}
              <h2 className={`text-sm font-semibold ${config.colorClass}`}>
                {config.label}
              </h2>
              <span
                className={`rounded-full bg-slate-700 px-2 py-0.5 text-xs ${config.colorClass}`}
              >
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {items.map((cadence) => (
                <CadenceStepCard
                  key={cadence.id}
                  cadence={cadence}
                  isOwner={isViewingOwn}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Session buttons — only show when viewing own cadences */}
      {isViewingOwn && (
        <div className="flex gap-3 border-t border-slate-700 pt-6">
          <Link
            href="/session?type=email"
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
            Start Email Session
          </Link>
          <Link
            href="/session?type=call"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
              />
            </svg>
            Start Call Session
          </Link>
        </div>
      )}
    </div>
  );
}
