"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  PRIORITY_COLORS,
} from "@/lib/types";
import { ReEnrichButton } from "./re-enrich-button";
import { LeadEditForm } from "./lead-edit-form";

interface LeadHeaderProps {
  lead: Lead;
  currentUserId?: string;
  teamMembers?: { id: string; full_name: string | null }[];
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function LeadHeader({ lead, currentUserId, teamMembers = [] }: LeadHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const assignedMember = teamMembers.find((m) => m.id === lead.assigned_to);

  async function handleAssign(assignToId: string | null) {
    await supabase
      .from("leads")
      .update({ assigned_to: assignToId })
      .eq("id", lead.id);
    setShowAssignModal(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [lead.id] }),
      });
      if (response.ok) {
        router.push("/");
      } else {
        const err = await response.json().catch(() => ({ error: "Delete failed" }));
        setDeleteError(err.error ?? "Failed to delete lead");
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      setDeleteError("Network error — could not delete lead");
      setShowDeleteConfirm(false);
    }
    setDeleting(false);
  }

  return (
    <div>
      {/* Back + Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-slate-400">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <span>/</span>
        <span className="text-slate-200">{lead.name}</span>
      </nav>

      {/* Delete error banner */}
      {deleteError && (
        <div className="mb-3 rounded-md border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-3 text-xs text-red-400 underline hover:text-red-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white">{lead.name}</h1>
              {lead.enriched_at && (
                <svg
                  className="h-5 w-5 text-yellow-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-label="Enriched"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {lead.category && (
                <span className="text-sm text-slate-400">{lead.category}</span>
              )}
              {lead.city && (
                <span className="text-sm text-slate-400">
                  {lead.address ? `${lead.address}, ` : ""}
                  {lead.city}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              {editing ? "Cancel Edit" : "Edit"}
            </button>
            <ReEnrichButton leadId={lead.id} leadName={lead.name} enrichedAt={lead.enriched_at ?? null} />
            <button
              onClick={() => setShowAssignModal(true)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              {assignedMember ? `Assigned: ${assignedMember.full_name}` : "Assign"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/30 hover:text-red-300"
            >
              Delete
            </button>
            {lead.priority && (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  PRIORITY_COLORS[lead.priority] ??
                  "bg-slate-600 text-slate-200"
                }`}
              >
                {lead.priority}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                PIPELINE_STAGE_COLORS[lead.pipeline_stage]
              }`}
            >
              {PIPELINE_STAGE_LABELS[lead.pipeline_stage]}
            </span>
          </div>
        </div>

        {/* Contact info row */}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-700 pt-4">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              {lead.phone}
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              {lead.email}
            </a>
          )}
          {lead.website && (
            <a
              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.47.353-2.856.978-4.082" />
              </svg>
              Website
            </a>
          )}
        </div>

        {/* Owner / Enrichment info */}
        {(lead.owner_name || lead.owner_email) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-emerald-800/40 bg-emerald-900/20 px-4 py-2.5">
            <span className="text-xs font-medium uppercase text-emerald-400">Owner</span>
            {lead.owner_name && (
              <span className="text-sm text-white">{lead.owner_name}</span>
            )}
            {lead.owner_email && (
              <a
                href={`mailto:${lead.owner_email}`}
                className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                {lead.owner_email}
              </a>
            )}
          </div>
        )}

        {/* Social links with follower counts */}
        {(lead.instagram || lead.tiktok || lead.facebook || lead.linkedin || lead.linkedin_company) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {lead.instagram && (
              <a
                href={
                  lead.instagram.startsWith("http")
                    ? lead.instagram
                    : `https://instagram.com/${lead.instagram.replace("@", "")}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-pink-400"
              >
                Instagram
                {lead.instagram_followers != null && (
                  <span className="rounded-full bg-pink-900/30 px-1.5 py-0.5 text-[10px] text-pink-300">
                    {lead.instagram_followers >= 1000
                      ? `${(lead.instagram_followers / 1000).toFixed(1)}K`
                      : lead.instagram_followers}
                  </span>
                )}
              </a>
            )}
            {lead.tiktok && (
              <a
                href={
                  lead.tiktok.startsWith("http")
                    ? lead.tiktok
                    : `https://tiktok.com/@${lead.tiktok.replace("@", "")}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                TikTok
                {lead.tiktok_followers != null && (
                  <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {lead.tiktok_followers >= 1000
                      ? `${(lead.tiktok_followers / 1000).toFixed(1)}K`
                      : lead.tiktok_followers}
                  </span>
                )}
              </a>
            )}
            {lead.facebook && (
              <a
                href={
                  lead.facebook.startsWith("http")
                    ? lead.facebook
                    : `https://facebook.com/${lead.facebook}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400"
              >
                Facebook
                {lead.facebook_followers != null && (
                  <span className="rounded-full bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-300">
                    {lead.facebook_followers >= 1000
                      ? `${(lead.facebook_followers / 1000).toFixed(1)}K`
                      : lead.facebook_followers}
                  </span>
                )}
              </a>
            )}
            {lead.linkedin && (
              <a
                href={
                  lead.linkedin.startsWith("http")
                    ? lead.linkedin
                    : `https://linkedin.com/in/${lead.linkedin}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400"
              >
                LinkedIn
              </a>
            )}
            {lead.linkedin_company && (
              <a
                href={
                  lead.linkedin_company.startsWith("http")
                    ? lead.linkedin_company
                    : `https://linkedin.com/company/${lead.linkedin_company}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400"
              >
                LinkedIn (Company)
              </a>
            )}
          </div>
        )}
      </div>

      {/* Inline edit form */}
      {editing && (
        <LeadEditForm lead={lead} onClose={() => setEditing(false)} />
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white">
              Assign {lead.name}
            </h3>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => handleAssign(null)}
                className="flex w-full items-center gap-3 rounded-md border border-slate-500 bg-slate-700/50 px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:border-amber-500 hover:bg-slate-600 hover:text-white"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-xs text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                  </svg>
                </span>
                <span>Unassign</span>
              </button>
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleAssign(member.id)}
                  className={`flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm text-white transition-colors hover:border-blue-500 hover:bg-slate-600 ${
                    member.id === lead.assigned_to
                      ? "border-blue-500 bg-slate-600"
                      : "border-slate-600 bg-slate-700"
                  }`}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {getInitials(member.full_name)}
                  </span>
                  <span>{member.full_name ?? "Unknown"}</span>
                  {member.id === lead.assigned_to && (
                    <span className="ml-auto text-xs text-blue-400">current</span>
                  )}
                  {member.id === currentUserId && member.id !== lead.assigned_to && (
                    <span className="ml-auto text-xs text-slate-400">(you)</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white">Delete Lead</h3>
            <p className="mt-2 text-sm text-slate-400">
              Are you sure you want to permanently delete{" "}
              <span className="font-medium text-white">{lead.name}</span>?
              This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
