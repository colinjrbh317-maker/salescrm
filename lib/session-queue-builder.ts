// Smart queue builder for sessions
// Priority order: overdue cadence steps → today's steps → uncontacted leads
// Filtered by session type (email/call/DM/mixed)

import type { Cadence, Lead, SessionType, ActivityType } from "./types";

// Map session types to matching activity types in cadences
const SESSION_TYPE_CHANNELS: Record<SessionType, ActivityType[]> = {
  email: ["cold_email", "follow_up_email"],
  call: ["cold_call", "follow_up_call"],
  dm: ["social_dm"],
  mixed: [
    "cold_call", "cold_email", "social_dm", "follow_up_call",
    "follow_up_email", "walk_in", "meeting",
  ],
};

export interface QueueItem {
  leadId: string;
  cadenceId: string | null;
  reason: "overdue" | "today" | "uncontacted";
}

export function buildSessionQueue(
  cadences: (Cadence & { lead_id: string })[],
  leads: Lead[],
  sessionType: SessionType,
  userId: string
): QueueItem[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const matchingChannels = SESSION_TYPE_CHANNELS[sessionType];

  // Filter cadences: pending + matching channel type
  const pendingCadences = cadences.filter(
    (c) =>
      !c.completed_at &&
      !c.skipped &&
      c.user_id === userId &&
      matchingChannels.includes(c.channel as ActivityType)
  );

  // 1. Overdue steps (scheduled before today, most overdue first)
  const overdue = pendingCadences
    .filter((c) => new Date(c.scheduled_at) < todayStart)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )
    .map((c): QueueItem => ({
      leadId: c.lead_id,
      cadenceId: c.id,
      reason: "overdue",
    }));

  // 2. Today's scheduled steps
  const today = pendingCadences
    .filter((c) => {
      const d = new Date(c.scheduled_at);
      return d >= todayStart && d < todayEnd;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )
    .map((c): QueueItem => ({
      leadId: c.lead_id,
      cadenceId: c.id,
      reason: "today",
    }));

  // 3. Uncontacted assigned leads (no last_contacted_at, by composite_score desc)
  const leadIdsInQueue = new Set([
    ...overdue.map((q) => q.leadId),
    ...today.map((q) => q.leadId),
  ]);

  const uncontacted = leads
    .filter(
      (l) =>
        l.assigned_to === userId &&
        !l.last_contacted_at &&
        !leadIdsInQueue.has(l.id) &&
        l.pipeline_stage === "cold"
    )
    .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
    .map((l): QueueItem => ({
      leadId: l.id,
      cadenceId: null,
      reason: "uncontacted",
    }));

  return [...overdue, ...today, ...uncontacted];
}
