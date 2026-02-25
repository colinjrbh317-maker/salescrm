// Channel-specific outcome configurations
// Each session type gets its own set of outcomes, colors, and keyboard shortcuts

import type { Outcome, SessionType } from "./types";

export interface ChannelOutcome {
  key: Outcome;
  label: string;
  color: string;
  shortcut: string;
}

export const CHANNEL_OUTCOMES: Record<SessionType, ChannelOutcome[]> = {
  email: [
    { key: "sent", label: "Sent", color: "bg-emerald-600 hover:bg-emerald-500", shortcut: "1" },
    { key: "bounced", label: "Bounced", color: "bg-red-600 hover:bg-red-500", shortcut: "2" },
    { key: "replied", label: "Replied", color: "bg-blue-600 hover:bg-blue-500", shortcut: "3" },
    { key: "not_interested", label: "Not Interested", color: "bg-slate-600 hover:bg-slate-500", shortcut: "4" },
  ],
  call: [
    { key: "connected", label: "Connected", color: "bg-emerald-600 hover:bg-emerald-500", shortcut: "1" },
    { key: "voicemail", label: "Voicemail", color: "bg-amber-600 hover:bg-amber-500", shortcut: "2" },
    { key: "no_answer", label: "No Answer", color: "bg-slate-600 hover:bg-slate-500", shortcut: "3" },
    { key: "callback_requested", label: "Callback", color: "bg-blue-600 hover:bg-blue-500", shortcut: "4" },
  ],
  dm: [
    { key: "sent", label: "Sent", color: "bg-emerald-600 hover:bg-emerald-500", shortcut: "1" },
    { key: "replied", label: "Replied", color: "bg-blue-600 hover:bg-blue-500", shortcut: "2" },
    { key: "not_interested", label: "Not Interested", color: "bg-red-600 hover:bg-red-500", shortcut: "3" },
  ],
  mixed: [
    { key: "connected", label: "Connected", color: "bg-emerald-600 hover:bg-emerald-500", shortcut: "1" },
    { key: "voicemail", label: "Voicemail", color: "bg-amber-600 hover:bg-amber-500", shortcut: "2" },
    { key: "no_answer", label: "No Answer", color: "bg-slate-600 hover:bg-slate-500", shortcut: "3" },
    { key: "not_interested", label: "Not Interested", color: "bg-red-600 hover:bg-red-500", shortcut: "4" },
  ],
};

// Walk-in outcomes (used when session type is mixed with walk-in leads, or future walk-in sessions)
export const WALKIN_OUTCOMES: ChannelOutcome[] = [
  { key: "connected", label: "Spoke With Owner", color: "bg-emerald-600 hover:bg-emerald-500", shortcut: "1" },
  { key: "sent", label: "Left Info", color: "bg-amber-600 hover:bg-amber-500", shortcut: "2" },
  { key: "no_answer", label: "Business Closed", color: "bg-slate-600 hover:bg-slate-500", shortcut: "3" },
  { key: "not_interested", label: "Not Interested", color: "bg-red-600 hover:bg-red-500", shortcut: "4" },
];

export type SessionChannelMode = SessionType | "walkin";

/** Get the activity type for logging based on session type */
export function getActivityType(sessionType: SessionChannelMode) {
  const map = {
    call: "cold_call" as const,
    email: "cold_email" as const,
    dm: "social_dm" as const,
    mixed: "cold_call" as const,
    walkin: "walk_in" as const,
  };
  return map[sessionType];
}

/** Get the channel for logging based on session type */
export function getChannel(sessionType: SessionChannelMode) {
  const map = {
    call: "phone" as const,
    email: "email" as const,
    dm: "instagram" as const,
    mixed: "phone" as const,
    walkin: "in_person" as const,
  };
  return map[sessionType];
}
