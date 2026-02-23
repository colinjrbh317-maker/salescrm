import type { Lead } from "@/lib/types";

const CHANNEL_ICONS: Record<string, string> = {
  phone: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
  email: "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
  instagram: "M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z",
  tiktok: "m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z",
  in_person: "M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z",
  facebook: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z",
};

const CHANNEL_COLORS: Record<string, string> = {
  phone: "bg-green-900/50 text-green-300 border-green-700/50",
  email: "bg-blue-900/50 text-blue-300 border-blue-700/50",
  instagram: "bg-pink-900/50 text-pink-300 border-pink-700/50",
  tiktok: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",
  in_person: "bg-amber-900/50 text-amber-300 border-amber-700/50",
  facebook: "bg-indigo-900/50 text-indigo-300 border-indigo-700/50",
};

export function AiBriefingSection({ lead }: { lead: Lead }) {
  const briefing = lead.ai_briefing;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        AI Briefing
      </h2>

      {!briefing ? (
        <div className="rounded-md border border-dashed border-slate-600 p-6 text-center">
          <svg
            className="mx-auto h-8 w-8 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
          <p className="mt-2 text-sm text-slate-500">
            No AI briefing generated yet
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Briefings will be auto-generated after prospecting
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          {briefing.summary && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-400">
                Summary
              </p>
              <p className="text-sm leading-relaxed text-slate-200">
                {briefing.summary}
              </p>
            </div>
          )}

          {/* Recommended Channel */}
          {(briefing.recommended_channel || lead.ai_channel_rec) && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">
                Recommended Channel
              </p>
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                    CHANNEL_COLORS[
                      briefing.recommended_channel ?? lead.ai_channel_rec ?? ""
                    ] ?? "bg-blue-900/50 text-blue-300 border-blue-700/50"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={
                        CHANNEL_ICONS[
                          briefing.recommended_channel ??
                            lead.ai_channel_rec ??
                            ""
                        ] ?? CHANNEL_ICONS.phone
                      }
                    />
                  </svg>
                  {(
                    briefing.recommended_channel ??
                    lead.ai_channel_rec ??
                    ""
                  )
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
                {briefing.channel_reasoning && (
                  <p className="pt-0.5 text-sm text-slate-400">
                    {briefing.channel_reasoning}
                  </p>
                )}
              </div>
              {/* Best Time to Call */}
              {briefing.best_time_to_call && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-blue-700/40 bg-blue-900/20 px-3 py-2">
                  <svg
                    className="h-4 w-4 shrink-0 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <span className="text-sm text-blue-200">
                    <span className="font-medium">Best time to reach:</span>{" "}
                    {briefing.best_time_to_call}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Audience & Content (for creators/podcasters) */}
          {(briefing.audience_profile || briefing.content_style) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {briefing.audience_profile && (
                <div className="rounded-md border border-purple-700/40 bg-purple-900/20 px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-purple-400">
                    Audience Profile
                  </p>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {briefing.audience_profile}
                  </p>
                </div>
              )}
              {briefing.content_style && (
                <div className="rounded-md border border-cyan-700/40 bg-cyan-900/20 px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-cyan-400">
                    Content Style
                  </p>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {briefing.content_style}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Talking Points */}
          {briefing.talking_points && briefing.talking_points.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">
                Talking Points
              </p>
              <ul className="space-y-2">
                {briefing.talking_points.map(
                  (point, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-sm text-slate-300"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-900/40 text-xs font-medium text-blue-400">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {/* Objections */}
          {briefing.objections &&
            briefing.objections.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-400">
                  Objections to Prepare For
                </p>
                <ul className="space-y-2">
                  {briefing.objections.map(
                    (objection, i) => (
                      <li
                        key={i}
                        className="flex gap-2.5 text-sm text-slate-300"
                      >
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                          />
                        </svg>
                        <span className="leading-relaxed">{objection}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
