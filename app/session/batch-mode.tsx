"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Lead, Outcome } from "@/lib/types";
import { mergeFields } from "@/lib/merge-fields";

interface BatchModeProps {
  leads: Lead[];
  scripts: Record<string, string>;
  sessionType: "email" | "dm";
  userId: string;
  sessionId: string;
  onOutcome: (outcome: Outcome, note: string | null) => Promise<boolean>;
  onSnooze: () => Promise<void>;
  onComplete: () => void;
}

interface BatchMessage {
  leadId: string;
  subject: string;
  body: string;
  status: "ready" | "edited" | "error";
  sent: boolean;
}

type Phase = "generate" | "review" | "fire";

export default function BatchMode({
  leads,
  scripts,
  sessionType,
  onOutcome,
  onSnooze,
  onComplete,
}: BatchModeProps) {
  const [phase, setPhase] = useState<Phase>("generate");
  const [messages, setMessages] = useState<BatchMessage[]>([]);
  const [generateProgress, setGenerateProgress] = useState(0);

  // Review phase
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Fire phase
  const [fireIndex, setFireIndex] = useState(0);
  const [fireEditing, setFireEditing] = useState(false);
  const [fireEditBody, setFireEditBody] = useState("");
  const [firedCount, setFiredCount] = useState(0);
  const [copiedFlash, setCopiedFlash] = useState(false);

  const fireTextareaRef = useRef<HTMLTextAreaElement>(null);
  const leadById = useMemo(() => {
    return new Map(leads.map((lead) => [lead.id, lead]));
  }, [leads]);

  // Phase 1: Generate messages on mount
  useEffect(() => {
    if (phase !== "generate") return;

    let cancelled = false;

    async function generate() {
      const result: BatchMessage[] = [];

      for (let i = 0; i < leads.length; i++) {
        if (cancelled) return;

        const lead = leads[i];
        const scriptContent = scripts[lead.id] ?? null;

        let body: string;
        let subject = "";
        const status: "ready" | "error" = "ready";

        if (scriptContent) {
          const merged = mergeFields(scriptContent, lead);
          body = merged.text;

          if (sessionType === "email") {
            // Extract subject from first line if it starts with "Subject:"
            const lines = body.split("\n");
            if (lines[0]?.toLowerCase().startsWith("subject:")) {
              subject = lines[0].replace(/^subject:\s*/i, "").trim();
              body = lines.slice(1).join("\n").trim();
            } else {
              subject = `Reaching out to ${lead.name}`;
            }
          }
        } else {
          body = `Hi ${lead.name},\n\nI wanted to reach out regarding your business${lead.category ? ` in ${lead.category}` : ""}${lead.city ? ` in ${lead.city}` : ""}.\n\nWould love to connect and discuss how we can help.\n\nBest regards`;
          subject = sessionType === "email" ? `Reaching out to ${lead.name}` : "";
        }

        result.push({
          leadId: lead.id,
          subject,
          body,
          status,
          sent: false,
        });

        setGenerateProgress(i + 1);

        // Small yield to keep UI responsive
        if (i % 5 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (!cancelled) {
        setMessages(result);
        setPhase("review");
      }
    }

    generate();
    return () => {
      cancelled = true;
    };
  }, [phase, leads, scripts, sessionType]);

  // Review phase: edit handler
  const handleEditMessage = useCallback(
    (index: number, field: "body" | "subject", value: string) => {
      setMessages((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          [field]: value,
          status: "edited" as const,
        };
        return next;
      });
    },
    []
  );

  const toggleExpand = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  const readyCount = messages.filter(
    (m) => m.status === "ready" || m.status === "edited"
  ).length;

  const handleFireSend = useCallback(async () => {
    const msg = messages[fireIndex];
    if (!msg) return;

    const textToCopy =
      sessionType === "email" && msg.subject
        ? `Subject: ${msg.subject}\n\n${msg.body}`
        : msg.body;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 800);
    } catch {
      // Clipboard might fail in some contexts
    }

    // Mark sent
    setMessages((prev) => {
      const next = [...prev];
      next[fireIndex] = { ...next[fireIndex], sent: true };
      return next;
    });

    setFiredCount((c) => c + 1);

    // Log outcome
    await onOutcome("sent", null);

    // Advance
    const nextIndex = fireIndex + 1;
    if (nextIndex >= messages.length) {
      onComplete();
    } else {
      setFireIndex(nextIndex);
      setFireEditing(false);
    }
  }, [fireIndex, messages, sessionType, onOutcome, onComplete]);

  const handleFireSnooze = useCallback(async () => {
    await onSnooze();
    const nextIndex = fireIndex + 1;
    if (nextIndex >= messages.length) {
      onComplete();
    } else {
      setFireIndex(nextIndex);
      setFireEditing(false);
    }
  }, [fireIndex, messages.length, onSnooze, onComplete]);

  // Fire phase: keyboard shortcuts
  useEffect(() => {
    if (phase !== "fire") return;

    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;

      // If editing, only handle Escape to exit edit mode
      if (fireEditing) {
        if (e.key === "Escape") {
          e.preventDefault();
          // Save edits and exit edit mode
          setMessages((prev) => {
            const next = [...prev];
            const fi = fireIndex;
            if (next[fi]) {
              next[fi] = { ...next[fi], body: fireEditBody, status: "edited" };
            }
            return next;
          });
          setFireEditing(false);
        }
        return;
      }

      // Ignore if focus is in form elements (except our fire mode)
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleFireSend();
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        const msg = messages[fireIndex];
        if (msg) {
          setFireEditBody(msg.body);
          setFireEditing(true);
          setTimeout(() => fireTextareaRef.current?.focus(), 50);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleFireSnooze();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, fireIndex, fireEditing, fireEditBody, messages, handleFireSend, handleFireSnooze]);

  const handleCopySubject = useCallback(async () => {
    const msg = messages[fireIndex];
    if (!msg?.subject) return;
    try {
      await navigator.clipboard.writeText(msg.subject);
    } catch {
      // ignore
    }
  }, [fireIndex, messages]);

  // =====================
  // RENDER
  // =====================

  // Phase 1: Generate
  if (phase === "generate") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="text-sm font-medium text-white">
          Generating messages...
        </div>
        <div className="h-2 w-64 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{
              width: `${leads.length > 0 ? (generateProgress / leads.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="text-xs text-slate-400">
          {generateProgress} / {leads.length} leads
        </div>
      </div>
    );
  }

  // Phase 2: Review
  if (phase === "review") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Review Messages ({messages.length})
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {readyCount} ready
            </span>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {messages.map((msg, idx) => {
            const lead = leadById.get(msg.leadId);
            if (!lead) return null;
            const isExpanded = expandedIndex === idx;

            return (
              <div
                key={msg.leadId}
                className="rounded-lg border border-slate-700 bg-slate-800"
              >
                {/* Header row */}
                <button
                  onClick={() => toggleExpand(idx)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">
                      {lead.name}
                    </span>
                    {lead.category && (
                      <span className="text-xs text-slate-500">
                        {lead.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {msg.status === "ready" && (
                      <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Ready
                      </span>
                    )}
                    {msg.status === "edited" && (
                      <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        Edited
                      </span>
                    )}
                    {msg.status === "error" && (
                      <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                        Error
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {isExpanded ? "\u25B2" : "\u25BC"}
                    </span>
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="border-t border-slate-700 px-4 py-3 space-y-3">
                    {sessionType === "email" && (
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">
                          Subject
                        </label>
                        <input
                          type="text"
                          value={msg.subject}
                          onChange={(e) =>
                            handleEditMessage(idx, "subject", e.target.value)
                          }
                          className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">
                        Message
                      </label>
                      <textarea
                        value={msg.body}
                        onChange={(e) =>
                          handleEditMessage(idx, "body", e.target.value)
                        }
                        rows={6}
                        className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        disabled
                        className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-500 cursor-not-allowed"
                        title="AI regeneration coming soon"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Start Firing button */}
        <button
          onClick={() => setPhase("fire")}
          disabled={readyCount === 0}
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          Start Firing ({readyCount} messages)
        </button>
      </div>
    );
  }

  // Phase 3: Fire
  const currentFireMessage = messages[fireIndex];
  const currentFireLead = currentFireMessage
    ? leadById.get(currentFireMessage.leadId)
    : null;

  if (!currentFireMessage || !currentFireLead) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {firedCount}/{messages.length} fired
        </h2>
        <div className="text-xs text-slate-400">
          {currentFireLead.name}
          {currentFireLead.category ? ` \u2022 ${currentFireLead.category}` : ""}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{
            width: `${(firedCount / messages.length) * 100}%`,
          }}
        />
      </div>

      {/* Copied flash */}
      {copiedFlash && (
        <div className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-1.5 text-center text-xs text-emerald-400">
          Copied to clipboard
        </div>
      )}

      {/* Message card */}
      <div className="rounded-lg border border-slate-700 bg-slate-800">
        {/* Lead header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {currentFireLead.name}
            </span>
            {currentFireLead.category && (
              <span className="text-xs text-slate-500">
                {currentFireLead.category}
              </span>
            )}
          </div>
          {currentFireMessage.status === "edited" && (
            <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              Edited
            </span>
          )}
        </div>

        {/* Subject (email only) */}
        {sessionType === "email" && currentFireMessage.subject && (
          <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2">
            <div className="text-sm text-slate-300">
              <span className="text-xs text-slate-500 mr-2">Subject:</span>
              {currentFireMessage.subject}
            </div>
            <button
              onClick={handleCopySubject}
              className="shrink-0 rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-400 transition hover:border-slate-500 hover:text-white"
            >
              Copy Subject
            </button>
          </div>
        )}

        {/* Message body */}
        <div className="px-4 py-4">
          {fireEditing ? (
            <textarea
              ref={fireTextareaRef}
              value={fireEditBody}
              onChange={(e) => setFireEditBody(e.target.value)}
              rows={10}
              className="w-full rounded border border-blue-500 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none"
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200 font-sans">
              {currentFireMessage.body}
            </pre>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
        <span>
          <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-slate-300">
            Enter
          </kbd>{" "}
          Copy + Send
        </span>
        <span>
          <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-slate-300">
            E
          </kbd>{" "}
          Edit
        </span>
        {fireEditing && (
          <span>
            <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-slate-300">
              Esc
            </kbd>{" "}
            Save + Exit Edit
          </span>
        )}
        <span>
          <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-slate-300">
            \u2192
          </kbd>{" "}
          Snooze
        </span>
      </div>

      {/* Action buttons (mobile fallback) */}
      <div className="flex gap-2">
        <button
          onClick={handleFireSnooze}
          className="flex-1 rounded-lg border border-slate-600 bg-slate-700 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-600"
        >
          Snooze
        </button>
        {fireEditing ? (
          <button
            onClick={() => {
              setMessages((prev) => {
                const next = [...prev];
                next[fireIndex] = {
                  ...next[fireIndex],
                  body: fireEditBody,
                  status: "edited",
                };
                return next;
              });
              setFireEditing(false);
            }}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Save Edit
          </button>
        ) : (
          <button
            onClick={handleFireSend}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Copy + Send
          </button>
        )}
      </div>
    </div>
  );
}
