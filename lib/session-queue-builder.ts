// Smart queue builder for sessions
// Priority order: overdue cadence steps → today's steps → uncontacted leads
// Filtered by session type (email/call/DM/mixed)
// Call sessions use timing engine for secondary sort within each bucket

import type { Cadence, Lead, SessionType, ActivityType } from "./types";
import { scoreCurrentMoment } from "./call-timing";

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

// Map session types to matching ai_channel_rec values for uncontacted lead filtering
const SESSION_CHANNEL_REC_MATCH: Record<SessionType, string[]> = {
  email: ["cold_email", "follow_up_email"],
  call: ["cold_call", "follow_up_call"],
  dm: ["social_dm"],
  mixed: [], // empty = no filtering (include all)
};

export interface QueueItem {
  leadId: string;
  cadenceId: string | null;
  reason: "overdue" | "today" | "uncontacted";
  timingScore?: number;
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
  const isCallSession = sessionType === "call" || sessionType === "mixed";

  // Build a lead lookup for timing scores
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  // Helper: get timing score for a lead (used in call sessions)
  function getTimingScore(leadId: string): number {
    if (!isCallSession) return 0;
    const lead = leadMap.get(leadId);
    if (!lead) return 0;
    return scoreCurrentMoment(lead, now).score;
  }

  // Filter cadences: pending + matching channel type
  const pendingCadences = cadences.filter(
    (c) =>
      !c.completed_at &&
      !c.skipped &&
      c.user_id === userId &&
      matchingChannels.includes(c.channel as ActivityType)
  );

  // 1. Overdue steps (scheduled before today, most overdue first, timing as tiebreaker)
  const overdue = pendingCadences
    .filter((c) => new Date(c.scheduled_at) < todayStart)
    .sort((a, b) => {
      const timeDiff = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Tiebreak: better timing score first
      return getTimingScore(b.lead_id) - getTimingScore(a.lead_id);
    })
    .map((c): QueueItem => ({
      leadId: c.lead_id,
      cadenceId: c.id,
      reason: "overdue",
      timingScore: getTimingScore(c.lead_id),
    }));

  // 2. Today's scheduled steps (sort by timing score for call sessions)
  const today = pendingCadences
    .filter((c) => {
      const d = new Date(c.scheduled_at);
      return d >= todayStart && d < todayEnd;
    })
    .sort((a, b) => {
      if (isCallSession) {
        // For call sessions: best timing score first
        const scoreDiff = getTimingScore(b.lead_id) - getTimingScore(a.lead_id);
        if (scoreDiff !== 0) return scoreDiff;
      }
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    })
    .map((c): QueueItem => ({
      leadId: c.lead_id,
      cadenceId: c.id,
      reason: "today",
      timingScore: getTimingScore(c.lead_id),
    }));

  // 3. Uncontacted assigned leads (filtered by ai_channel_rec matching session type)
  const leadIdsInQueue = new Set([
    ...overdue.map((q) => q.leadId),
    ...today.map((q) => q.leadId),
  ]);

  const matchingRecs = SESSION_CHANNEL_REC_MATCH[sessionType];
  const filterByRec = matchingRecs.length > 0;

  const uncontacted = leads
    .filter(
      (l) =>
        l.assigned_to === userId &&
        !l.last_contacted_at &&
        !leadIdsInQueue.has(l.id) &&
        l.pipeline_stage === "cold" &&
        // Exclude leads whose recommended channel doesn't match session type
        (!filterByRec || !l.ai_channel_rec || matchingRecs.includes(l.ai_channel_rec))
    )
    .sort((a, b) => {
      if (isCallSession) {
        // For call sessions: timing score first, composite score as tiebreak
        const scoreA = scoreCurrentMoment(a, now).score;
        const scoreB = scoreCurrentMoment(b, now).score;
        const timingDiff = scoreB - scoreA;
        if (Math.abs(timingDiff) > 0.1) return timingDiff;
      }
      return (b.composite_score ?? 0) - (a.composite_score ?? 0);
    })
    .map((l): QueueItem => ({
      leadId: l.id,
      cadenceId: null,
      reason: "uncontacted",
      timingScore: isCallSession ? scoreCurrentMoment(l, now).score : undefined,
    }));

  return [...overdue, ...today, ...uncontacted];
}
