// Shared activity insert helper
// Used by both ActivityLogger component and Session system to prevent duplicate logic

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityType, Channel, Outcome, PipelineStage } from "./types";

// Outcomes that indicate positive engagement (contacted → warm)
const WARM_OUTCOMES: Outcome[] = [
  "connected",
  "interested",
  "replied",
  "callback_requested",
];

// Outcomes that indicate strong buying intent (warm → hot)
const HOT_OUTCOMES: Outcome[] = ["meeting_set", "proposal_requested"];

// Stages that auto-advance. Stages beyond "hot" are managed manually.
const ADVANCEABLE_STAGES: PipelineStage[] = ["cold", "contacted", "warm"];

/**
 * Determine the next pipeline stage based on current stage and activity outcome.
 * Returns null if no advancement should happen.
 * Pipeline only moves FORWARD, never backward.
 */
function getNextStage(
  currentStage: PipelineStage,
  outcome: Outcome | null
): PipelineStage | null {
  // Don't auto-advance stages beyond "hot"
  if (!ADVANCEABLE_STAGES.includes(currentStage)) return null;

  // Cold → Contacted: any activity logged (regardless of outcome)
  if (currentStage === "cold") {
    return "contacted";
  }

  // Need an outcome to advance further
  if (!outcome) return null;

  // Contacted → Warm: positive engagement
  if (currentStage === "contacted" && WARM_OUTCOMES.includes(outcome)) {
    return "warm";
  }

  // Warm → Hot: meeting set or proposal requested
  if (currentStage === "warm" && HOT_OUTCOMES.includes(outcome)) {
    return "hot" as PipelineStage;
  }

  // Contacted → Hot: skip warm if outcome is strong enough (meeting_set directly)
  if (currentStage === "contacted" && HOT_OUTCOMES.includes(outcome)) {
    return "hot" as PipelineStage;
  }

  return null;
}

/** Determine the next follow-up step based on current channel and outcome */
function getNextFollowUp(
  currentChannel: Channel,
  outcome: Outcome
): { activityType: ActivityType; daysOut: number } | null {
  // Not interested or wrong number — no follow-up
  if (outcome === "not_interested" || outcome === "wrong_number") return null;

  // Meeting set or proposal — no auto-follow-up (manual pipeline management)
  if (outcome === "meeting_set" || outcome === "proposal_requested") return null;

  const followUpMap: Record<string, Record<string, { activityType: ActivityType; daysOut: number }>> = {
    phone: {
      connected: { activityType: "follow_up_email", daysOut: 1 }, // Connected → follow-up email tomorrow
      voicemail: { activityType: "follow_up_call", daysOut: 2 }, // Voicemail → retry call in 2 days
      no_answer: { activityType: "follow_up_call", daysOut: 2 }, // No answer → retry in 2 days
      callback_requested: { activityType: "follow_up_call", daysOut: 1 }, // Callback → call tomorrow
    },
    email: {
      sent: { activityType: "social_dm", daysOut: 3 }, // Email sent → DM in 3 days
      bounced: { activityType: "follow_up_call", daysOut: 1 }, // Bounced → call instead
      replied: { activityType: "follow_up_email", daysOut: 2 }, // Replied → follow-up email
    },
    instagram: {
      sent: { activityType: "social_dm", daysOut: 5 }, // DM sent → follow-up DM in 5 days
      replied: { activityType: "social_dm", daysOut: 2 }, // Replied → follow-up quickly
    },
    facebook: {
      sent: { activityType: "social_dm", daysOut: 5 },
      replied: { activityType: "social_dm", daysOut: 2 },
    },
    tiktok: {
      sent: { activityType: "social_dm", daysOut: 5 },
      replied: { activityType: "social_dm", daysOut: 2 },
    },
    in_person: {
      connected: { activityType: "follow_up_call", daysOut: 1 }, // Met owner → call next day
      sent: { activityType: "follow_up_call", daysOut: 2 }, // Left info → call in 2 days
      no_answer: { activityType: "follow_up_call", daysOut: 3 }, // Closed → call in 3 days
    },
  };

  return followUpMap[currentChannel]?.[outcome] ?? null;
}

interface LogActivityParams {
  supabase: SupabaseClient;
  leadId: string;
  userId: string;
  activityType: ActivityType;
  channel: Channel;
  outcome: Outcome | null;
  notes: string | null;
  isPrivate?: boolean;
}

export async function logActivity({
  supabase,
  leadId,
  userId,
  activityType,
  channel,
  outcome,
  notes,
  isPrivate = false,
}: LogActivityParams): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("activities").insert({
    lead_id: leadId,
    user_id: userId,
    activity_type: activityType,
    channel,
    outcome,
    notes,
    is_private: isPrivate,
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Fetch current pipeline stage for advancement logic
  const { data: lead } = await supabase
    .from("leads")
    .select("pipeline_stage")
    .eq("id", leadId)
    .single();

  const currentStage = (lead?.pipeline_stage as PipelineStage) ?? "cold";
  const nextStage = getNextStage(currentStage, outcome);

  // Update lead: always set last_contacted_at, optionally advance pipeline
  const updateData: Record<string, unknown> = {
    last_contacted_at: new Date().toISOString(),
  };

  if (nextStage) {
    updateData.pipeline_stage = nextStage;
  }

  await supabase.from("leads").update(updateData).eq("id", leadId);

  // Auto-complete matching cadence step
  // Find the first pending cadence step for this lead that matches the activity channel
  try {
    const channelMatches = getMatchingCadenceChannels(activityType);
    if (channelMatches.length > 0) {
      const { data: pendingStep } = await supabase
        .from("cadences")
        .select("id")
        .eq("lead_id", leadId)
        .eq("user_id", userId)
        .is("completed_at", null)
        .eq("skipped", false)
        .in("channel", channelMatches)
        .order("step_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (pendingStep) {
        await supabase
          .from("cadences")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", pendingStep.id);
      }
    }
  } catch {
    // Cadence step completion is non-critical — don't fail the activity log
  }

  // Auto-advance: create next follow-up cadence step based on outcome
  try {
    if (outcome) {
      const nextStep = getNextFollowUp(channel, outcome);
      if (nextStep) {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + nextStep.daysOut);
        // Skip weekends
        while (scheduledDate.getDay() === 0 || scheduledDate.getDay() === 6) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        // Get current max step number for this lead
        const { data: maxStep } = await supabase
          .from("cadences")
          .select("step_number")
          .eq("lead_id", leadId)
          .eq("user_id", userId)
          .order("step_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase.from("cadences").insert({
          lead_id: leadId,
          user_id: userId,
          step_number: (maxStep?.step_number ?? 0) + 1,
          channel: nextStep.activityType,
          scheduled_at: scheduledDate.toISOString(),
          completed_at: null,
          skipped: false,
        });
      }
    }
  } catch {
    // Auto-advance is non-critical
  }

  return { success: true };
}

/** Map activity types to cadence channel values for matching */
function getMatchingCadenceChannels(activityType: ActivityType): string[] {
  const map: Record<string, string[]> = {
    cold_call: ["cold_call", "follow_up_call", "phone"],
    cold_email: ["cold_email", "follow_up_email", "email"],
    social_dm: ["social_dm", "instagram", "facebook", "tiktok", "linkedin"],
    follow_up_call: ["follow_up_call", "cold_call", "phone"],
    follow_up_email: ["follow_up_email", "cold_email", "email"],
    walk_in: ["walk_in", "in_person"],
  };
  return map[activityType] ?? [];
}
