"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadType, PipelineStage } from "@/lib/types";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  PRIORITY_COLORS,
  LEAD_TYPES,
  LEAD_TYPE_LABELS,
  LEAD_TYPE_COLORS,
} from "@/lib/types";

// We only show these columns in the kanban (exclude "dead")
const KANBAN_STAGES: PipelineStage[] = [
  "cold",
  "contacted",
  "warm",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

function getNextStage(current: PipelineStage): PipelineStage | null {
  const idx = KANBAN_STAGES.indexOf(current);
  if (idx === -1 || idx >= KANBAN_STAGES.length - 1) return null;
  // Skip closed_lost when advancing
  const next = KANBAN_STAGES[idx + 1];
  return next === "closed_lost" ? null : next;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface PipelineBoardProps {
  leads: Lead[];
  currentUserId: string;
}

type PipelineView = "my" | "all";

export function PipelineBoard({ leads, currentUserId }: PipelineBoardProps) {
  const [pipelineView, setPipelineView] = useState<PipelineView>("my");
  const [filterType, setFilterType] = useState<LeadType | "">("");
  const [filterSearch, setFilterSearch] = useState("");

  const visibleLeads = useMemo(() => {
    let filtered = leads;
    // Per-user pipeline: default to "My Leads"
    if (pipelineView === "my") {
      filtered = filtered.filter((l) => l.assigned_to === currentUserId);
    }
    if (filterType) filtered = filtered.filter((l) => l.lead_type === filterType);
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      filtered = filtered.filter(
        (l) => l.name?.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [leads, pipelineView, currentUserId, filterType, filterSearch]);

  const [closingLead, setClosingLead] = useState<Lead | null>(null);
  const [closeStage, setCloseStage] = useState<"closed_won" | "closed_lost">(
    "closed_won"
  );
  const [closeReason, setCloseReason] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{ stage: PipelineStage; index: number } | null>(null);
  const dragLeadRef = useRef<Lead | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function moveToStage(lead: Lead, toStage: PipelineStage) {
    // Don't move to same stage
    if (lead.pipeline_stage === toStage) return;

    // If moving to closed_won or closed_lost, show modal
    if (toStage === "closed_won" || toStage === "closed_lost") {
      setClosingLead(lead);
      setCloseStage(toStage);
      setCloseReason("");
      setCloseAmount("");
      return;
    }

    setMovingId(lead.id);
    setMoveError(null);

    try {
      // Record pipeline history
      const { error: histErr } = await supabase.from("pipeline_history").insert({
        lead_id: lead.id,
        user_id: currentUserId,
        from_stage: lead.pipeline_stage,
        to_stage: toStage,
      });
      if (histErr) throw histErr;

      // Update the lead
      const { error: updateErr } = await supabase
        .from("leads")
        .update({ pipeline_stage: toStage })
        .eq("id", lead.id);
      if (updateErr) throw updateErr;

      // Log a stage_change activity
      await supabase.from("activities").insert({
        lead_id: lead.id,
        user_id: currentUserId,
        activity_type: "stage_change",
        channel: "other",
        notes: `Moved from ${PIPELINE_STAGE_LABELS[lead.pipeline_stage]} to ${PIPELINE_STAGE_LABELS[toStage]}`,
        is_private: false,
        occurred_at: new Date().toISOString(),
      });

      router.refresh();
    } catch {
      setMoveError(`Failed to move ${lead.name} to ${PIPELINE_STAGE_LABELS[toStage]}`);
      setTimeout(() => setMoveError(null), 5000);
    }
    setMovingId(null);
  }

  async function handleClose() {
    if (!closingLead) return;

    setMovingId(closingLead.id);
    setMoveError(null);

    try {
      // Record pipeline history
      const { error: histErr } = await supabase.from("pipeline_history").insert({
        lead_id: closingLead.id,
        user_id: currentUserId,
        from_stage: closingLead.pipeline_stage,
        to_stage: closeStage,
        reason: closeReason || null,
      });
      if (histErr) throw histErr;

      // Update the lead
      const { error: updateErr } = await supabase
        .from("leads")
        .update({
          pipeline_stage: closeStage,
          closed_at: new Date().toISOString(),
          close_reason: closeReason || null,
          close_amount: closeAmount ? parseFloat(closeAmount) : null,
        })
        .eq("id", closingLead.id);
      if (updateErr) throw updateErr;

      // Log activity
      await supabase.from("activities").insert({
        lead_id: closingLead.id,
        user_id: currentUserId,
        activity_type: "stage_change",
        channel: "other",
        notes: `${closeStage === "closed_won" ? "Won" : "Lost"}: ${closeReason || "No reason provided"}${closeAmount ? ` ($${closeAmount})` : ""}`,
        is_private: false,
        occurred_at: new Date().toISOString(),
      });

      setClosingLead(null);
      router.refresh();
    } catch {
      setMoveError(`Failed to close ${closingLead.name}`);
      setClosingLead(null);
      setTimeout(() => setMoveError(null), 5000);
    }
    setMovingId(null);
  }

  // Drag handlers
  function handleDragStart(e: React.DragEvent, lead: Lead) {
    dragLeadRef.current = lead;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id);
    // Add a slight delay to allow the drag image to render before adding opacity
    const target = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      target.style.opacity = "0.4";
    });
  }

  function handleDragEnd(e: React.DragEvent) {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "1";
    setDragOverStage(null);
    setDragOverPosition(null);
    dragLeadRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  }

  function handleCardDragOver(e: React.DragEvent, stage: PipelineStage, cardIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    // Don't show insertion on the source column
    if (dragLeadRef.current?.pipeline_stage === stage) return;

    // Detect top/bottom half of the card
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertIndex = e.clientY < midY ? cardIndex : cardIndex + 1;

    if (dragOverStage !== stage) setDragOverStage(stage);
    if (!dragOverPosition || dragOverPosition.stage !== stage || dragOverPosition.index !== insertIndex) {
      setDragOverPosition({ stage, index: insertIndex });
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if we're leaving the column entirely (not entering a child)
    const related = e.relatedTarget as HTMLElement | null;
    const current = e.currentTarget as HTMLElement;
    if (!related || !current.contains(related)) {
      setDragOverStage(null);
      setDragOverPosition(null);
    }
  }

  function handleDrop(e: React.DragEvent, toStage: PipelineStage) {
    e.preventDefault();
    setDragOverStage(null);
    setDragOverPosition(null);
    const lead = dragLeadRef.current;
    if (lead && lead.pipeline_stage !== toStage) {
      moveToStage(lead, toStage);
    }
    dragLeadRef.current = null;
  }

  return (
    <>
      {/* Move error banner */}
      {moveError && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {moveError}
          <button onClick={() => setMoveError(null)} className="ml-3 text-xs text-red-400 underline hover:text-red-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Pipeline View Toggle + Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* My Leads / All Leads toggle */}
        <div className="flex items-center rounded-md border border-slate-600 bg-slate-800">
          <button
            onClick={() => setPipelineView("my")}
            className={`rounded-l-md px-3 py-2 text-xs font-medium transition-colors ${
              pipelineView === "my"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            My Leads ({leads.filter((l) => l.assigned_to === currentUserId).length})
          </button>
          <button
            onClick={() => setPipelineView("all")}
            className={`rounded-r-md px-3 py-2 text-xs font-medium transition-colors ${
              pipelineView === "all"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All Leads ({leads.length})
          </button>
        </div>
        <input
          type="text"
          placeholder="Search pipeline..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="w-full max-w-xs rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterType("")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === "" ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All ({leads.length})
          </button>
          {LEAD_TYPES.map((t) => {
            const count = leads.filter((l) => l.lead_type === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setFilterType(filterType === t ? "" : t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterType === t
                    ? LEAD_TYPE_COLORS[t]
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {LEAD_TYPE_LABELS[t]} ({count})
              </button>
            );
          })}
        </div>
        {(filterType || filterSearch) && (
          <span className="text-xs text-slate-500">
            Showing {visibleLeads.length} of {leads.length}
          </span>
        )}
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map((stage) => {
          const stageLeads = visibleLeads.filter((l) => l.pipeline_stage === stage);
          const isDragTarget = dragOverStage === stage;
          const isSourceStage = dragLeadRef.current?.pipeline_stage === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage)}
              className={`flex w-72 min-w-72 flex-col rounded-lg border transition-colors ${
                isDragTarget && !isSourceStage
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-700 bg-slate-800/50"
              }`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PIPELINE_STAGE_COLORS[stage]}`}
                  >
                    {PIPELINE_STAGE_LABELS[stage]}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3" style={{ minHeight: "80px" }}>
                {stageLeads.length === 0 ? (
                  <p className={`py-4 text-center text-xs ${isDragTarget ? "text-blue-400" : "text-slate-600"}`}>
                    {isDragTarget ? "Drop here" : "No leads"}
                  </p>
                ) : (
                  stageLeads.map((lead, cardIndex) => {
                    const daysInStage = daysSince(lead.updated_at);
                    const nextStage = getNextStage(stage);
                    const isMoving = movingId === lead.id;
                    const showInsertBefore = dragOverPosition?.stage === stage && dragOverPosition.index === cardIndex;
                    const showInsertAfter = dragOverPosition?.stage === stage && dragOverPosition.index === cardIndex + 1 && cardIndex === stageLeads.length - 1;

                    return (
                      <div key={lead.id}>
                        {/* Insertion indicator — before this card */}
                        {showInsertBefore && (
                          <div className="my-1 h-0.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                        )}
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, stage, cardIndex)}
                          className="cursor-grab rounded-md border border-slate-700 bg-slate-800 p-2.5 transition-colors hover:border-slate-600 active:cursor-grabbing"
                          onClick={() => router.push(`/leads/${lead.id}`)}
                        >
                        {/* Lead name + favicon */}
                        <div className="flex items-center gap-1.5">
                          {lead.website && (
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(lead.website.replace(/^https?:\/\//, ""))}&sz=32`}
                              alt=""
                              className="h-4 w-4 shrink-0 rounded"
                              loading="lazy"
                            />
                          )}
                          <span className="text-sm font-medium text-white">
                            {lead.name}
                          </span>
                        </div>

                        {/* Category */}
                        {lead.category && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {lead.category}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="mt-2 flex items-center justify-between">
                          {lead.priority && (
                            <span
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                PRIORITY_COLORS[lead.priority] ??
                                "bg-slate-600 text-slate-200"
                              }`}
                            >
                              {lead.priority}
                            </span>
                          )}
                          {daysInStage != null && (
                            <span className={`text-[10px] ${
                              daysInStage <= 3 ? "text-emerald-500" : daysInStage <= 7 ? "text-amber-500" : "text-red-400"
                            }`}>
                              {daysInStage}d in stage
                            </span>
                          )}
                        </div>

                        {/* Move buttons */}
                        <div className="mt-2 flex gap-1.5">
                          {nextStage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveToStage(lead, nextStage);
                              }}
                              disabled={isMoving}
                              className="flex-1 rounded bg-blue-600/80 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                            >
                              {isMoving
                                ? "..."
                                : `Move to ${PIPELINE_STAGE_LABELS[nextStage]}`}
                            </button>
                          )}
                          {stage !== "closed_won" && stage !== "closed_lost" && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveToStage(lead, "closed_won");
                                }}
                                disabled={isMoving}
                                className="rounded bg-emerald-600/80 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                              >
                                Won
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveToStage(lead, "closed_lost");
                                }}
                                disabled={isMoving}
                                className="rounded bg-red-600/80 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                              >
                                Lost
                              </button>
                            </>
                          )}
                        </div>
                        </div>
                        {/* Insertion indicator — after last card */}
                        {showInsertAfter && (
                          <div className="my-1 h-0.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Close modal */}
      {closingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">
              {closeStage === "closed_won" ? "Mark as Won" : "Mark as Lost"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {closingLead.name}
            </p>

            <div className="mt-4 space-y-4">
              {/* Close stage toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCloseStage("closed_won")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    closeStage === "closed_won"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  Won
                </button>
                <button
                  onClick={() => setCloseStage("closed_lost")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    closeStage === "closed_lost"
                      ? "bg-red-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  Lost
                </button>
              </div>

              {/* Amount (for wins) */}
              {closeStage === "closed_won" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Deal Amount ($)
                  </label>
                  <input
                    type="number"
                    value={closeAmount}
                    onChange={(e) => setCloseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  {closeStage === "closed_won"
                    ? "Win Reason"
                    : "Loss Reason"}
                </label>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  rows={3}
                  placeholder={
                    closeStage === "closed_won"
                      ? "What convinced them to sign?"
                      : "Why did we lose this deal?"
                  }
                  className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setClosingLead(null)}
                className="rounded-md px-4 py-2 text-sm text-slate-400 transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                  closeStage === "closed_won"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {closeStage === "closed_won" ? "Mark as Won" : "Mark as Lost"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
