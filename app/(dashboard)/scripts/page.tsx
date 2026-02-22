import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  "cold-email": "Cold Email",
  "social-dm": "Social DM",
  "cold-call": "Cold Call",
  "in-person": "In-Person",
  "response-handling": "Response Handling",
  closing: "Closing",
  "post-sale": "Post-Sale",
  sops: "SOPs",
  overview: "Overview",
};

const CATEGORY_ORDER = [
  "overview",
  "cold-email",
  "social-dm",
  "cold-call",
  "in-person",
  "response-handling",
  "closing",
  "post-sale",
  "sops",
];

const CATEGORY_COLORS: Record<string, string> = {
  "cold-email": "bg-blue-600/20 text-blue-400 border-blue-500/30",
  "social-dm": "bg-purple-600/20 text-purple-400 border-purple-500/30",
  "cold-call": "bg-amber-600/20 text-amber-400 border-amber-500/30",
  "in-person": "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
  "response-handling": "bg-orange-600/20 text-orange-400 border-orange-500/30",
  closing: "bg-red-600/20 text-red-400 border-red-500/30",
  "post-sale": "bg-teal-600/20 text-teal-400 border-teal-500/30",
  sops: "bg-slate-600/20 text-slate-400 border-slate-500/30",
  overview: "bg-indigo-600/20 text-indigo-400 border-indigo-500/30",
};

interface Script {
  id: string;
  title: string;
  category: string;
  sort_order: number;
}

interface CommentCount {
  script_id: string;
  count: number;
}

export default async function ScriptsPage() {
  const supabase = await createClient();

  // Fetch all scripts
  const { data: scripts } = await supabase
    .from("scripts")
    .select("id, title, category, sort_order")
    .order("sort_order", { ascending: true });

  // Fetch comment counts per script
  const { data: commentsRaw } = await supabase
    .from("script_comments")
    .select("script_id");

  // Build comment count map
  const commentCounts = new Map<string, number>();
  if (commentsRaw) {
    for (const row of commentsRaw) {
      const current = commentCounts.get(row.script_id) || 0;
      commentCounts.set(row.script_id, current + 1);
    }
  }

  const typedScripts = (scripts ?? []) as Script[];

  // Group scripts by category
  const grouped = new Map<string, Script[]>();
  for (const script of typedScripts) {
    const list = grouped.get(script.category) || [];
    list.push(script);
    grouped.set(script.category, list);
  }

  // Sort categories by defined order
  const sortedCategories = CATEGORY_ORDER.filter((cat) => grouped.has(cat));
  // Add any categories not in the predefined order
  for (const cat of grouped.keys()) {
    if (!sortedCategories.includes(cat)) {
      sortedCategories.push(cat);
    }
  }

  const isEmpty = typedScripts.length === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scripts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sales scripts organized by outreach category
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/scripts/comments"
            className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Comment Board
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 py-20">
          <div className="mb-4 text-4xl text-slate-600">
            {/* Document icon */}
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            No scripts loaded
          </h2>
          <p className="text-sm text-slate-400">
            No scripts have been loaded yet.
          </p>
        </div>
      )}

      {/* Script grid by category */}
      {!isEmpty && (
        <div className="space-y-8">
          {sortedCategories.map((category) => {
            const categoryScripts = grouped.get(category) ?? [];
            const label = CATEGORY_LABELS[category] || category;
            const colorClass =
              CATEGORY_COLORS[category] ||
              "bg-slate-600/20 text-slate-400 border-slate-500/30";

            return (
              <section key={category}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">{label}</h2>
                  <span className="text-xs text-slate-500">
                    {categoryScripts.length} script
                    {categoryScripts.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {categoryScripts.map((script) => {
                    const count = commentCounts.get(script.id) || 0;
                    return (
                      <Link
                        key={script.id}
                        href={`/scripts/${script.id}`}
                        className="group rounded-lg border border-slate-700 bg-slate-800 p-4 hover:border-slate-600 hover:bg-slate-750 transition-colors"
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-white leading-snug group-hover:text-blue-400 transition-colors">
                            {script.title}
                          </h3>
                          {count > 0 && (
                            <span className="flex-shrink-0 inline-flex items-center rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                              {count}
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}
                        >
                          {label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
