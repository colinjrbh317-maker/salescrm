"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadType, PipelineStage } from "@/lib/types";
import { LEAD_TYPES, LEAD_TYPE_LABELS, PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/lib/types";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const LABEL_CLASS = "block text-xs font-medium text-slate-400 mb-1";

interface LeadEditFormProps {
  lead: Lead;
  onClose: () => void;
}

export function LeadEditForm({ lead, onClose }: LeadEditFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: lead.name,
    lead_type: lead.lead_type,
    category: lead.category ?? "",
    city: lead.city ?? "",
    address: lead.address ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    website: lead.website ?? "",
    owner_name: lead.owner_name ?? "",
    owner_email: lead.owner_email ?? "",
    instagram: lead.instagram ?? "",
    tiktok: lead.tiktok ?? "",
    facebook: lead.facebook ?? "",
    pipeline_stage: lead.pipeline_stage,
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const updateData: Record<string, unknown> = {
      name: form.name.trim(),
      lead_type: form.lead_type,
      pipeline_stage: form.pipeline_stage,
      category: form.category.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      has_website: !!form.website.trim(),
      owner_name: form.owner_name.trim() || null,
      owner_email: form.owner_email.trim() || null,
      instagram: form.instagram.trim() || null,
      tiktok: form.tiktok.trim() || null,
      facebook: form.facebook.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", lead.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    setTimeout(() => {
      onClose();
      router.refresh();
    }, 500);
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-600 bg-slate-800/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Edit Lead
        </h2>
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-emerald-700 bg-emerald-900/30 px-4 py-2 text-sm text-emerald-300">
          Saved!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Type</label>
            <select
              value={form.lead_type}
              onChange={(e) => update("lead_type", e.target.value)}
              className={INPUT_CLASS}
            >
              {LEAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LEAD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL_CLASS}>Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Restaurant"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Pipeline Stage</label>
            <select
              value={form.pipeline_stage}
              onChange={(e) => update("pipeline_stage", e.target.value)}
              className={INPUT_CLASS}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        {/* Contact */}
        <div className="border-t border-slate-700 pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Contact
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Owner Name</label>
              <input
                type="text"
                value={form.owner_name}
                onChange={(e) => update("owner_name", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Owner Email</label>
              <input
                type="email"
                value={form.owner_email}
                onChange={(e) => update("owner_email", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        {/* Social */}
        <div className="border-t border-slate-700 pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Social Media
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={LABEL_CLASS}>Instagram</label>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) => update("instagram", e.target.value)}
                placeholder="@handle"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>TikTok</label>
              <input
                type="text"
                value={form.tiktok}
                onChange={(e) => update("tiktok", e.target.value)}
                placeholder="@handle"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Facebook</label>
              <input
                type="text"
                value={form.facebook}
                onChange={(e) => update("facebook", e.target.value)}
                placeholder="Page name"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t border-slate-700 pt-4">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
