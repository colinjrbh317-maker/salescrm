"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
  lead_count: number;
}

interface TeamStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function TeamStep({ onNext, onBack }: TeamStepProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      const supabase = createClient();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, role");

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Fetch lead counts for each team member
      const membersWithCounts: TeamMember[] = await Promise.all(
        profiles.map(async (p) => {
          const { count } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", p.id);

          return {
            id: p.id,
            full_name: p.full_name,
            role: p.role,
            lead_count: count ?? 0,
          };
        })
      );

      // Sort by lead count descending for competitive feel
      membersWithCounts.sort((a, b) => b.lead_count - a.lead_count);
      setMembers(membersWithCounts);
      setLoading(false);
    }

    fetchTeam();
  }, []);

  function getInitial(name: string | null): string {
    if (!name) return "?";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    salesperson: "Salesperson",
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-8">
      <h2 className="mb-2 text-2xl font-bold text-white">Meet the Team</h2>
      <p className="mb-6 text-slate-300">
        Here is who you will be working with. See where everyone stands and
        find your competitive edge.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
        </div>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-slate-400">
          No team members found. You are the first one here!
        </p>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {members.map((member, idx) => (
            <div
              key={member.id}
              className="flex items-center gap-4 rounded-lg border border-slate-600 bg-slate-700 p-4"
            >
              {/* Rank badge */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-slate-300">
                {idx + 1}
              </div>

              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {getInitial(member.full_name)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {member.full_name ?? "Unnamed"}
                </p>
                <p className="text-xs text-slate-400">
                  {ROLE_LABELS[member.role] ?? member.role}
                </p>
              </div>

              {/* Lead count */}
              <div className="text-right">
                <p className="text-lg font-bold text-blue-400">
                  {member.lead_count}
                </p>
                <p className="text-xs text-slate-400">leads</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
