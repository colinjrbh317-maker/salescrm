import type { Lead } from "@/lib/types";

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-300">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-700">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: string | boolean | null;
  positive?: boolean;
}) {
  if (value == null) return null;

  let display: string;
  let colorClass = "text-slate-300";

  if (typeof value === "boolean") {
    display = value ? "Yes" : "No";
    colorClass = value === positive ? "text-emerald-400" : "text-red-400";
  } else {
    display = value;
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={colorClass}>{display}</span>
    </div>
  );
}

export function SalesIntelligence({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Sales Intelligence
      </h2>

      {/* Google presence */}
      {(lead.google_rating != null || lead.review_count != null) && (
        <div className="mb-4 rounded-md bg-slate-700/50 p-3">
          <p className="mb-1 text-xs font-medium text-slate-400">
            Google Business
          </p>
          <div className="flex items-center gap-4">
            {lead.google_rating != null && (
              <div className="flex items-center gap-1">
                <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-medium text-white">
                  {lead.google_rating}
                </span>
              </div>
            )}
            {lead.review_count != null && (
              <span className="text-sm text-slate-400">
                {lead.review_count} reviews
              </span>
            )}
          </div>
        </div>
      )}

      {/* Website checks */}
      <div className="mb-4 space-y-0.5 divide-y divide-slate-700/50">
        <InfoRow label="Has Website" value={lead.has_website} positive={true} />
        <InfoRow label="SSL Valid" value={lead.ssl_valid} positive={true} />
        <InfoRow
          label="Mobile Friendly"
          value={lead.mobile_friendly}
          positive={true}
        />
        <InfoRow label="Content Freshness" value={lead.content_freshness} />
      </div>

      {/* Composite score */}
      {lead.composite_score != null && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-300">Composite Score</span>
            <span
              className={`text-lg font-bold ${
                lead.composite_score <= 30
                  ? "text-red-400"
                  : lead.composite_score <= 60
                  ? "text-yellow-400"
                  : "text-emerald-400"
              }`}
            >
              {lead.composite_score}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-700">
            <div
              className={`h-2 rounded-full ${
                lead.composite_score <= 30
                  ? "bg-red-500"
                  : lead.composite_score <= 60
                  ? "bg-yellow-500"
                  : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, lead.composite_score))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Individual scores */}
      <div className="space-y-3">
        <ScoreBar label="Design" value={lead.design_score} />
        <ScoreBar label="Technical" value={lead.technical_score} />
        <ScoreBar label="Visual" value={lead.visual_score} />
        <ScoreBar label="Content" value={lead.content_score} />
        <ScoreBar label="Mobile" value={lead.mobile_score} />
        <ScoreBar label="Presence" value={lead.presence_score} />
      </div>

      {/* Sources */}
      {lead.sources && lead.sources.length > 0 && (
        <div className="mt-4 border-t border-slate-700 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-400">Sources</p>
          <div className="flex flex-wrap gap-1">
            {lead.sources.map((source, i) => (
              <span
                key={i}
                className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
