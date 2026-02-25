"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Lead, Outcome } from "@/lib/types";
import { CHANNEL_OUTCOMES } from "@/lib/channel-outcomes";
import { mergeFields } from "@/lib/merge-fields";
import LeadNameLink from "../lead-name-link";

// ============================================================
// Helpers
// ============================================================

type SocialPlatform = "instagram" | "tiktok" | "facebook";

interface SocialInfo {
  platform: SocialPlatform;
  handle: string;
  followers: number | null;
  url: string;
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

function buildSocialUrl(platform: SocialPlatform, value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  const handle = value.replace(/^@/, "");
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "facebook":
      return `https://www.facebook.com/${handle}`;
  }
}

function formatFollowers(n: number | null): string {
  if (n === null || n === 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

/** Detect all social platforms the lead has and return info for each */
function detectSocials(lead: Lead): SocialInfo[] {
  const socials: SocialInfo[] = [];

  if (lead.instagram) {
    socials.push({
      platform: "instagram",
      handle: lead.instagram,
      followers: lead.instagram_followers,
      url: buildSocialUrl("instagram", lead.instagram),
      label: "IG",
      color: "text-pink-400",
      borderColor: "border-pink-700/50",
      bgColor: "bg-pink-900/20",
      textColor: "text-pink-400",
    });
  }
  if (lead.facebook) {
    socials.push({
      platform: "facebook",
      handle: lead.facebook,
      followers: lead.facebook_followers,
      url: buildSocialUrl("facebook", lead.facebook),
      label: "FB",
      color: "text-blue-400",
      borderColor: "border-blue-700/50",
      bgColor: "bg-blue-900/20",
      textColor: "text-blue-300",
    });
  }
  if (lead.tiktok) {
    socials.push({
      platform: "tiktok",
      handle: lead.tiktok,
      followers: lead.tiktok_followers,
      url: buildSocialUrl("tiktok", lead.tiktok),
      label: "TT",
      color: "text-slate-300",
      borderColor: "border-slate-600/50",
      bgColor: "bg-slate-700/20",
      textColor: "text-slate-300",
    });
  }

  return socials;
}

/** Pick the primary social (first available: IG > FB > TT) */
function getPrimarySocial(socials: SocialInfo[]): SocialInfo | null {
  return socials[0] ?? null;
}

// ============================================================
// Platform Icons (inline SVG)
// ============================================================

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TiktokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function PlatformIcon({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  switch (platform) {
    case "instagram":
      return <InstagramIcon className={className} />;
    case "facebook":
      return <FacebookIcon className={className} />;
    case "tiktok":
      return <TiktokIcon className={className} />;
  }
}

// ============================================================
// Props
// ============================================================

interface DmSessionCardProps {
  lead: Lead;
  scriptContent: string | null;
  onOutcome: (outcome: Outcome, note: string | null) => Promise<boolean>;
  onSnooze: () => void;
  onOpenLeadDetails: () => void;
}

// ============================================================
// Component
// ============================================================

const DM_OUTCOMES = CHANNEL_OUTCOMES.dm;

export default function DmSessionCard({
  lead,
  scriptContent,
  onOutcome,
  onSnooze,
  onOpenLeadDetails,
}: DmSessionCardProps) {
  const socials = detectSocials(lead);
  const primary = getPrimarySocial(socials);

  // Pre-fill textarea with merged script content
  const initialMessage = scriptContent
    ? mergeFields(scriptContent, lead).text
    : "";

  const [message, setMessage] = useState(initialMessage);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyMessage = useCallback(() => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const channel = primary?.platform || "dm";
      const res = await fetch("/api/generate-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, channel }),
      });

      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const error =
          typeof data.error === "string"
            ? data.error
            : `Generation failed (${res.status})`;
        setGenError(error);
        return;
      }

      setMessage(typeof data.body === "string" ? data.body : "");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }, [lead.id, primary]);

  const handleLog = useCallback(async () => {
    if (!selectedOutcome) return;
    setSubmitting(true);

    // 5-second timeout fallback
    timeoutRef.current = setTimeout(() => {
      setSubmitting(false);
    }, 5000);

    const success = await onOutcome(selectedOutcome, message.trim() || null);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!success) {
      setSubmitting(false);
    }
  }, [message, onOutcome, selectedOutcome]);

  // Keyboard shortcuts: 1-3 = outcomes, S = snooze, Enter = log
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1") {
        setSelectedOutcome(DM_OUTCOMES[0].key);
      } else if (e.key === "2") {
        setSelectedOutcome(DM_OUTCOMES[1].key);
      } else if (e.key === "3") {
        setSelectedOutcome(DM_OUTCOMES[2].key);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        onSnooze();
      } else if (e.key === "Enter" && selectedOutcome && !submitting) {
        e.preventDefault();
        void handleLog();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleLog, onSnooze, selectedOutcome, submitting]);

  const briefing = lead.ai_briefing;

  return (
    <div className="space-y-3">
      {/* ============ LEAD HEADER + SOCIAL IDENTITY ============ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Lead name + primary platform icon + handle */}
            <div className="flex items-center gap-2">
              <LeadNameLink
                lead={lead}
                onOpenLeadDetails={onOpenLeadDetails}
                className="text-lg font-semibold"
              />
              {primary && (
                <PlatformIcon
                  platform={primary.platform}
                  className={`h-5 w-5 ${primary.color}`}
                />
              )}
            </div>

            {/* Primary handle + follower count */}
            {primary && (
              <div className="mt-1 flex items-center gap-2">
                <a
                  href={primary.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm font-medium ${primary.textColor} hover:underline`}
                >
                  @{primary.handle.replace(/^@/, "")}
                </a>
                {primary.followers ? (
                  <span className="text-xs text-slate-500">
                    {formatFollowers(primary.followers)} followers
                  </span>
                ) : null}
              </div>
            )}

            {/* Category + City */}
            {(lead.category || lead.city) && (
              <p className="mt-1.5 text-sm text-slate-400">
                {[lead.category, lead.city].filter(Boolean).join(" \u2022 ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============ PRE-ENGAGEMENT TIP ============ */}
      {primary && (
        <div className="flex items-center justify-between rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 shrink-0 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <p className="text-sm font-medium text-amber-300">
              Like their last 3 posts before sending
            </p>
          </div>
          <a
            href={primary.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md border border-amber-600/50 bg-amber-800/30 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-800/50"
          >
            Open Profile
          </a>
        </div>
      )}

      {/* ============ MAIN AREA: COMPOSE + SIDE ============ */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ---- Compose Area (2/3) ---- */}
        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
              DM Message
            </label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your DM..."
              rows={6}
              className="w-full resize-y rounded-md border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={copyMessage}
                className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white"
              >
                {copied ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                      />
                    </svg>
                    Copy Message
                  </>
                )}
              </button>
              <button
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-600 hover:text-white disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    {message ? "Regenerate" : "Generate"}
                  </>
                )}
              </button>
            </div>
            {genError && (
              <div className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                {genError}
              </div>
            )}
          </div>
        </div>

        {/* ---- Side Panel (1/3) ---- */}
        <div className="space-y-3">
          {/* Social Links */}
          {socials.length > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Social Links
              </h3>
              <div className="space-y-1.5">
                {socials.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 rounded-md border ${s.borderColor} ${s.bgColor} px-3 py-1.5 text-sm font-medium ${s.textColor} transition hover:opacity-80`}
                  >
                    <PlatformIcon
                      platform={s.platform}
                      className="h-4 w-4"
                    />
                    {s.label}:{" "}
                    {s.handle.length > 20 ? `${s.handle.slice(0, 20)}...` : s.handle}
                    {s.followers ? (
                      <span className="ml-auto text-xs opacity-60">
                        {formatFollowers(s.followers)}
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Recent Engagement Notes */}
          {lead.shared_notes && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Recent Notes
              </h3>
              <p className="text-sm text-slate-400 line-clamp-4">
                {lead.shared_notes}
              </p>
            </div>
          )}

          {/* AI Briefing (Collapsed) */}
          {briefing && (
            <div className="rounded-lg border border-slate-700 bg-slate-800">
              <button
                onClick={() => setShowBriefing(!showBriefing)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  AI Briefing
                </h3>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform ${showBriefing ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>
              {showBriefing && (
                <div className="space-y-2 border-t border-slate-700 px-4 pb-3 pt-2">
                  {briefing.summary && (
                    <p className="text-sm text-slate-400">{briefing.summary}</p>
                  )}
                  {briefing.audience_profile && (
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-400">
                        Audience:{" "}
                      </span>
                      {briefing.audience_profile}
                    </p>
                  )}
                  {briefing.content_style && (
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-400">
                        Content:{" "}
                      </span>
                      {briefing.content_style}
                    </p>
                  )}
                  {briefing.talking_points && briefing.talking_points.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-400">
                      {briefing.talking_points.map((tp, i) => (
                        <li key={i}>{tp}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============ LOG OUTCOME ============ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Log Outcome</h3>

        <div className="grid grid-cols-3 gap-2">
          {DM_OUTCOMES.map((qo) => (
            <button
              key={qo.key}
              onClick={() => setSelectedOutcome(qo.key)}
              className={`rounded-lg py-2.5 text-sm font-semibold text-white transition ${qo.color} ${
                selectedOutcome === qo.key
                  ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                  : ""
              }`}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-black/20 text-xs font-mono">
                {qo.shortcut}
              </span>
              {qo.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSnooze}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-600"
          >
            <span className="mr-1.5 inline-flex items-center justify-center rounded bg-black/20 px-1 py-0.5 text-[10px] font-mono">
              S
            </span>
            Snooze
          </button>
          <button
            onClick={() => void handleLog()}
            disabled={!selectedOutcome || submitting}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? (
              "Logging..."
            ) : (
              <>
                Log
                <span className="ml-1.5 inline-flex items-center justify-center rounded bg-black/20 px-1 py-0.5 text-[10px] font-mono">
                  {"\u21B5"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
