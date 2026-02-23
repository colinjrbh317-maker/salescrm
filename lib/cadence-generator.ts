// Auto-cadence generator
// Creates 5-7 step cadence sequences from available channels
// Smart-times call steps using the timing engine

import type { Channel } from "./types";
import { classifyBusinessType, getNextBestWindow, type BusinessType } from "./call-timing";

// ============================================================
// Types
// ============================================================

export interface CadenceStep {
  step_number: number;
  channel: Channel;
  scheduled_at: string; // ISO string
  template_name: string;
}

export interface GenerateCadenceInput {
  leadId: string;
  userId: string;
  category: string | null;
  /** Available contact channels for this lead */
  availableChannels: {
    phone: boolean;
    email: boolean;
    instagram: boolean;
    facebook: boolean;
    tiktok: boolean;
  };
  /** AI-recommended first channel (from enrichment) */
  recommendedChannel?: string | null;
  /** Start date for the cadence (defaults to now) */
  startDate?: Date;
}

// ============================================================
// Channel mapping helpers
// ============================================================

/** Map channel type to the cadence channel value */
const CHANNEL_MAP: Record<string, Channel> = {
  phone: "phone",
  email: "email",
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
};

/** Map channel to step template names */
const TEMPLATE_MAP: Record<Channel, string[]> = {
  phone: ["cold_call", "follow_up_call", "final_call"],
  email: ["cold_email", "follow_up_email", "breakup_email"],
  instagram: ["social_dm_intro", "social_dm_follow_up"],
  facebook: ["social_dm_intro", "social_dm_follow_up"],
  tiktok: ["social_dm_intro", "social_dm_follow_up"],
  linkedin: ["social_dm_intro", "social_dm_follow_up"],
  in_person: ["walk_in"],
  other: ["general_outreach"],
};

/** Day offsets for cadence steps (spread over ~3 weeks) */
const DAY_OFFSETS = [0, 2, 5, 8, 12, 16, 21];

// ============================================================
// Channel sequence builder
// ============================================================

/**
 * Build a channel rotation sequence based on available channels.
 * Prioritizes recommended channel, rotates through available ones.
 */
function buildChannelSequence(
  available: GenerateCadenceInput["availableChannels"],
  recommended: string | null | undefined,
  stepCount: number
): Channel[] {
  // Collect available channels in priority order
  const channels: Channel[] = [];

  // Start with recommended if available
  if (recommended) {
    const mapped = CHANNEL_MAP[recommended.toLowerCase()];
    if (mapped && available[recommended.toLowerCase() as keyof typeof available]) {
      channels.push(mapped);
    }
  }

  // Add remaining channels in strategic order: phone > email > social
  const priority: (keyof typeof available)[] = ["phone", "email", "instagram", "facebook", "tiktok"];
  for (const ch of priority) {
    if (available[ch] && !channels.includes(CHANNEL_MAP[ch])) {
      channels.push(CHANNEL_MAP[ch]);
    }
  }

  if (channels.length === 0) return [];

  // Build the sequence with rotation
  const sequence: Channel[] = [];
  const templateCounters = new Map<Channel, number>();

  for (let i = 0; i < stepCount; i++) {
    // Rotate through channels, but front-load the primary channel
    let channel: Channel;
    if (i === 0) {
      // First touch: recommended or first available
      channel = channels[0];
    } else if (i === stepCount - 1 && channels.includes("phone")) {
      // Last step: always phone if available (final attempt = personal touch)
      channel = "phone";
    } else {
      // Rotate through channels
      channel = channels[i % channels.length];
    }

    sequence.push(channel);
    templateCounters.set(channel, (templateCounters.get(channel) ?? 0) + 1);
  }

  return sequence;
}

// ============================================================
// Main generator
// ============================================================

/**
 * Generate a cadence sequence for a lead based on available channels.
 * - 5-7 steps depending on available channels
 * - Rotates channels to avoid spamming one method
 * - Smart-times call steps using the timing engine
 * - Social DM steps scheduled during engagement hours
 */
export function generateCadence(input: GenerateCadenceInput): CadenceStep[] {
  const {
    category,
    availableChannels,
    recommendedChannel,
    startDate = new Date(),
  } = input;

  // Count available channels to determine step count
  const channelCount = Object.values(availableChannels).filter(Boolean).length;
  if (channelCount === 0) return [];

  // More channels = more steps (5-7)
  const stepCount = Math.min(7, Math.max(5, channelCount + 3));

  // Build channel sequence
  const channels = buildChannelSequence(availableChannels, recommendedChannel, stepCount);
  if (channels.length === 0) return [];

  // Classify business type for smart timing
  const businessType = classifyBusinessType(category);

  // Template counters for naming
  const templateCounters = new Map<Channel, number>();

  const steps: CadenceStep[] = [];

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const dayOffset = DAY_OFFSETS[i] ?? DAY_OFFSETS[DAY_OFFSETS.length - 1] + (i - DAY_OFFSETS.length + 1) * 3;

    // Calculate scheduled date
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(scheduledDate.getDate() + dayOffset);

    // Smart-time based on channel type
    if (channel === "phone") {
      // Use timing engine for call steps
      const bestWindow = getNextBestWindow(businessType, scheduledDate);
      scheduledDate.setTime(bestWindow.date.getTime());
    } else if (channel === "email") {
      // Emails: Tue-Thu 8am (caught in morning inbox review)
      adjustToBusinessHour(scheduledDate, 8);
    } else {
      // Social DMs: 12pm-2pm (engagement hours)
      adjustToBusinessHour(scheduledDate, 12);
    }

    // Template name
    const count = templateCounters.get(channel) ?? 0;
    const templates = TEMPLATE_MAP[channel] ?? ["general_outreach"];
    const templateName = templates[Math.min(count, templates.length - 1)];
    templateCounters.set(channel, count + 1);

    steps.push({
      step_number: i + 1,
      channel,
      scheduled_at: scheduledDate.toISOString(),
      template_name: templateName,
    });
  }

  return steps;
}

/** Skip weekends and set hour */
function adjustToBusinessHour(date: Date, hour: number) {
  // Skip Saturday/Sunday
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hour, 0, 0, 0);
}

/**
 * Detect available channels from a lead's data.
 * Used by the enrichment API to determine what channels to build cadences from.
 */
export function detectAvailableChannels(lead: {
  phone?: string | null;
  email?: string | null;
  owner_email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
}): GenerateCadenceInput["availableChannels"] {
  return {
    phone: !!lead.phone,
    email: !!(lead.email || lead.owner_email),
    instagram: !!lead.instagram,
    facebook: !!lead.facebook,
    tiktok: !!lead.tiktok,
  };
}
