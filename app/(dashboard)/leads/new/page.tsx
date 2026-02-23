"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { LeadType, PipelineStage } from "@/lib/types";
import { LEAD_TYPES, LEAD_TYPE_LABELS, PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/lib/types";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const LABEL_CLASS = "block text-xs font-medium text-slate-400 mb-1";

export default function NewLeadPage() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    lead_type: "business" as LeadType,
    category: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    owner_name: "",
    owner_email: "",
    instagram: "",
    tiktok: "",
    facebook: "",
    pipeline_stage: "cold" as PipelineStage,
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const insertData: Record<string, unknown> = {
      name: form.name.trim(),
      lead_type: form.lead_type,
      pipeline_stage: form.pipeline_stage,
    };

    // Only include non-empty optional fields
    if (form.category.trim()) insertData.category = form.category.trim();
    if (form.city.trim()) insertData.city = form.city.trim();
    if (form.address.trim()) insertData.address = form.address.trim();
    if (form.phone.trim()) insertData.phone = form.phone.trim();
    if (form.email.trim()) insertData.email = form.email.trim();
    if (form.website.trim()) {
      insertData.website = form.website.trim();
      insertData.has_website = true;
    }
    if (form.owner_name.trim()) insertData.owner_name = form.owner_name.trim();
    if (form.owner_email.trim()) insertData.owner_email = form.owner_email.trim();
    if (form.instagram.trim()) insertData.instagram = form.instagram.trim();
    if (form.tiktok.trim()) insertData.tiktok = form.tiktok.trim();
    if (form.facebook.trim()) insertData.facebook = form.facebook.trim();

    const { data, error: insertError } = await supabase
      .from("leads")
      .insert(insertData)
      .select("id")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to create lead");
      setSaving(false);
      return;
    }

    router.push(`/leads/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-200">New Lead</span>
      </nav>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h1 className="mb-6 text-xl font-bold text-white">Add New Lead</h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Basic Info
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Business name, podcast name, or creator name"
                  className={INPUT_CLASS}
                  autoFocus
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
              <div>
                <label className={LABEL_CLASS}>Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  placeholder="e.g. Restaurant, Roofing, Tech"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="City"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Full address"
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
          </div>

          {/* Contact Info */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Contact
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="contact@business.com"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://example.com"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Owner Name</label>
                <input
                  type="text"
                  value={form.owner_name}
                  onChange={(e) => update("owner_name", e.target.value)}
                  placeholder="John Smith"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Owner Email</label>
                <input
                  type="email"
                  value={form.owner_email}
                  onChange={(e) => update("owner_email", e.target.value)}
                  placeholder="john@business.com"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Social Media
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL_CLASS}>Instagram</label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={(e) => update("instagram", e.target.value)}
                  placeholder="@handle or URL"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>TikTok</label>
                <input
                  type="text"
                  value={form.tiktok}
                  onChange={(e) => update("tiktok", e.target.value)}
                  placeholder="@handle or URL"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Facebook</label>
                <input
                  type="text"
                  value={form.facebook}
                  onChange={(e) => update("facebook", e.target.value)}
                  placeholder="Page name or URL"
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
              {saving ? "Creating..." : "Create Lead"}
            </button>
            <Link
              href="/"
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
