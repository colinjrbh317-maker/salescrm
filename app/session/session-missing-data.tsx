import type { MissingDataWarning } from "@/lib/missing-data-check";

interface SessionMissingDataProps {
  warnings: MissingDataWarning[];
}

export default function SessionMissingData({
  warnings,
}: SessionMissingDataProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3">
      <div className="flex flex-wrap gap-2">
        {warnings.map((w) => (
          <span
            key={w.field}
            className="inline-flex items-center rounded bg-amber-600/20 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/30"
          >
            \u26A0 {w.label}
          </span>
        ))}
      </div>
    </div>
  );
}
