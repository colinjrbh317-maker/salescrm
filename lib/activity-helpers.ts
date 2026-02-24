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

  return { success: true };
}
