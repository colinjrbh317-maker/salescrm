// ============================================================
// Database Types — mirrors Supabase schema
// ============================================================

export type LeadType = "business" | "podcast" | "creator";

export type PipelineStage =
  | "cold"
  | "contacted"
  | "warm"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost"
  | "dead";

export type ActivityType =
  | "cold_call"
  | "cold_email"
  | "social_dm"
  | "walk_in"
  | "follow_up_call"
  | "follow_up_email"
  | "meeting"
  | "proposal_sent"
  | "note"
  | "stage_change";

export type Channel =
  | "phone"
  | "email"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "linkedin"
  | "in_person"
  | "other";

export type Outcome =
  | "connected"
  | "voicemail"
  | "no_answer"
  | "callback_requested"
  | "interested"
  | "not_interested"
  | "wrong_number"
  | "sent"
  | "opened"
  | "replied"
  | "bounced"
  | "meeting_set"
  | "proposal_requested"
  | "other";

export type UserRole = "admin" | "salesperson";

// ============================================================
// Table: leads
// ============================================================

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;

  // Type
  lead_type: LeadType;

  // Core fields
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;

  // Social
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  instagram_followers: number | null;
  tiktok_followers: number | null;
  facebook_followers: number | null;

  // Google
  google_rating: number | null;
  review_count: number | null;

  // Sources
  sources: string[] | null;

  // Scoring
  composite_score: number | null;
  priority: string | null;
  has_website: boolean | null;
  ssl_valid: boolean | null;
  mobile_friendly: boolean | null;
  design_score: number | null;
  technical_score: number | null;
  visual_score: number | null;
  content_score: number | null;
  mobile_score: number | null;
  presence_score: number | null;
  content_freshness: string | null;

  // CRM
  pipeline_stage: PipelineStage;
  assigned_to: string | null;
  ai_briefing: AiBriefing | null;
  ai_channel_rec: string | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  dead_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  close_amount: number | null;
  is_hot: boolean;

  // Enrichment
  owner_name: string | null;
  owner_email: string | null;
  enriched_at: string | null;

  // Notes
  notes: LeadNote[] | null;

  // Shared notes
  shared_notes: string | null;

  // Sync
  sheets_sync_key: string | null;
  last_synced_at: string | null;
  last_prospected_at: string | null;
}

export interface LeadNote {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  user_name: string;
}

export interface AiBriefing {
  summary?: string;
  talking_points?: string[];
  recommended_channel?: string;
  channel_reasoning?: string;
  objections?: string[];
  best_time_to_call?: string;
  audience_profile?: string;
  content_style?: string;
  [key: string]: unknown;
}

// ============================================================
// Table: activities
// ============================================================

export interface Activity {
  id: string;
  created_at: string;
  lead_id: string;
  user_id: string;
  activity_type: ActivityType;
  channel: Channel | null;
  outcome: Outcome | null;
  notes: string | null;
  is_private: boolean;
  duration_sec: number | null;
  occurred_at: string;
}

// ============================================================
// Table: cadences
// ============================================================

export interface Cadence {
  id: string;
  created_at: string;
  lead_id: string;
  user_id: string;
  step_number: number;
  channel: Channel;
  scheduled_at: string;
  completed_at: string | null;
  skipped: boolean;
  script_id: string | null;
  template_name: string | null;
}

// ============================================================
// Table: pipeline_history
// ============================================================

export interface PipelineHistory {
  id: string;
  created_at: string;
  lead_id: string;
  user_id: string;
  from_stage: PipelineStage;
  to_stage: PipelineStage;
  reason: string | null;
}

// ============================================================
// Table: profiles
// ============================================================

export interface Profile {
  id: string;
  created_at: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  onboarding_completed: boolean;
  preferred_channels: string[];
  goals: Goals | null;
}

export interface Goals {
  calls_per_day: number;
  emails_per_day: number;
  dms_per_day: number;
  deals_per_month: number;
  revenue_target: number;
}

// ============================================================
// Table: sessions
// ============================================================

export type SessionType = "email" | "call" | "dm" | "mixed";
export type SessionStatus = "active" | "completed" | "abandoned";

export interface Session {
  id: string;
  user_id: string;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  leads_worked: number;
  leads_skipped: number;
  outcomes_summary: Record<string, number>;
  lead_queue: string[];
  current_index: number;
  status: SessionStatus;
  streak_best: number;
  created_at: string;
}

export type SessionInsert = Omit<Session, "id" | "created_at">;

// ============================================================
// Derived / helper types
// ============================================================

export type LeadInsert = Omit<Lead, "id" | "created_at" | "updated_at">;
export type LeadUpdate = Partial<LeadInsert>;

export type ActivityInsert = Omit<Activity, "id" | "created_at">;

export type PipelineHistoryInsert = Omit<PipelineHistory, "id" | "created_at">;

export const PIPELINE_STAGES: PipelineStage[] = [
  "cold",
  "contacted",
  "warm",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
  "dead",
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  cold: "Cold",
  contacted: "Contacted",
  warm: "Warm",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
  dead: "Dead",
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  cold: "bg-slate-600 text-slate-200",
  contacted: "bg-blue-600 text-blue-100",
  warm: "bg-amber-600 text-amber-100",
  proposal: "bg-purple-600 text-purple-100",
  negotiation: "bg-orange-600 text-orange-100",
  closed_won: "bg-emerald-600 text-emerald-100",
  closed_lost: "bg-red-600 text-red-100",
  dead: "bg-gray-700 text-gray-300",
};

export const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-600 text-red-100",
  MEDIUM: "bg-yellow-600 text-yellow-100",
  LOW: "bg-emerald-600 text-emerald-100",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  cold_call: "Cold Call",
  cold_email: "Cold Email",
  social_dm: "Social DM",
  walk_in: "Walk-In",
  follow_up_call: "Follow-Up Call",
  follow_up_email: "Follow-Up Email",
  meeting: "Meeting",
  proposal_sent: "Proposal Sent",
  note: "Note",
  stage_change: "Stage Change",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  phone: "Phone",
  email: "Email",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  in_person: "In Person",
  other: "Other",
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  no_answer: "No Answer",
  callback_requested: "Callback Requested",
  interested: "Interested",
  not_interested: "Not Interested",
  wrong_number: "Wrong Number",
  sent: "Sent",
  opened: "Opened",
  replied: "Replied",
  bounced: "Bounced",
  meeting_set: "Meeting Set",
  proposal_requested: "Proposal Requested",
  other: "Other",
};

export const LEAD_TYPES: LeadType[] = ["business", "podcast", "creator"];

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  business: "Business",
  podcast: "Podcast",
  creator: "Creator",
};

export const LEAD_TYPE_COLORS: Record<LeadType, string> = {
  business: "bg-blue-600 text-blue-100",
  podcast: "bg-purple-600 text-purple-100",
  creator: "bg-pink-600 text-pink-100",
};

/** Map activity types to their most likely channels */
export const ACTIVITY_CHANNEL_MAP: Record<ActivityType, Channel[]> = {
  cold_call: ["phone"],
  cold_email: ["email"],
  social_dm: ["instagram", "tiktok", "facebook", "linkedin"],
  walk_in: ["in_person"],
  follow_up_call: ["phone"],
  follow_up_email: ["email"],
  meeting: ["in_person", "phone", "other"],
  proposal_sent: ["email", "in_person"],
  note: ["other"],
  stage_change: ["other"],
};
