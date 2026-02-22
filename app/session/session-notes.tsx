"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-helpers";
import type { Activity } from "@/lib/types";

interface SessionNotesProps {
  leadId: string;
  userId: string;
}

interface NoteWithAuthor extends Activity {
  profiles?: { full_name: string | null } | null;
}

export default function SessionNotes({ leadId, userId }: SessionNotesProps) {
  const [notes, setNotes] = useState<NoteWithAuthor[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("activities")
      .select("*, profiles(full_name)")
      .eq("lead_id", leadId)
      .eq("activity_type", "note")
      .eq("is_private", false)
      .order("created_at", { ascending: false });

    if (data) {
      setNotes(data as NoteWithAuthor[]);
    }
  }, [leadId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const result = await logActivity({
      supabase,
      leadId,
      userId,
      activityType: "note",
      channel: "other",
      outcome: null,
      notes: input.trim(),
      isPrivate: false,
    });

    if (result.success) {
      setInput("");
      await fetchNotes();
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h4 className="text-sm font-semibold text-slate-300">Shared Notes</h4>

      {/* Existing notes */}
      {notes.length > 0 && (
        <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded border border-slate-700 bg-slate-900 p-2"
            >
              <p className="text-sm text-slate-300">{note.notes}</p>
              <p className="mt-1 text-xs text-slate-500">
                {note.profiles?.full_name ?? "Unknown"} &middot;{" "}
                {new Date(note.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No shared notes yet.</p>
      )}

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a shared note..."
          className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !input.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "..." : "Add"}
        </button>
      </form>
    </div>
  );
}
