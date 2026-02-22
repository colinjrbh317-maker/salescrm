// Shared activity insert helper
// Used by both ActivityLogger component and Session system to prevent duplicate logic

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityType, Channel, Outcome } from "./types";

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

  // Update last_contacted_at on the lead
  await supabase
    .from("leads")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", leadId);

  return { success: true };
}
