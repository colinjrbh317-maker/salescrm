"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReEnrichButton({ leadId, leadName, enrichedAt }: { leadId: string; leadName: string; enrichedAt: string | null }) {
  const [enriching, setEnriching] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleEnrich() {
    setEnriching(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Enrichment failed" }));
        setError(err.error ?? "Enrichment failed");
        setTimeout(() => setError(null), 5000);
      } else {
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      }
    } catch {
      setError("Network error — could not enrich");
      setTimeout(() => setError(null), 5000);
    }
    setEnriching(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleEnrich}
      disabled={enriching}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        error
          ? "bg-red-600 text-white"
          : done
            ? "bg-emerald-600 text-white"
            : "bg-yellow-600 text-white hover:bg-yellow-700"
      } disabled:opacity-50`}
    >
      {enriching ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Enriching...
        </>
      ) : error ? (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          Failed
        </>
      ) : done ? (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Enriched
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {enrichedAt ? "Re-enrich" : "Enrich"}
        </>
      )}
    </button>
  );
}
