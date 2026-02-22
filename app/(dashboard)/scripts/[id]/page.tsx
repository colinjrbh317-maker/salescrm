import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ScriptViewer } from "./script-viewer";

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

interface Props {
  params: Promise<{ id: string }>;
}

export interface ScriptComment {
  id: string;
  script_id: string;
  paragraph_index: number;
  paragraph_text: string;
  comment: string;
  author_id: string | null;
  status: string;
  created_at: string;
}

export interface Script {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  file_path: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export default async function ScriptDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch the script
  const { data: script, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !script) {
    notFound();
  }

  // Fetch all comments for this script
  const { data: comments } = await supabase
    .from("script_comments")
    .select("*")
    .eq("script_id", id)
    .order("paragraph_index", { ascending: true });

  const categoryLabel = CATEGORY_LABELS[script.category] || script.category;

  return (
    <ScriptViewer
      script={script as Script}
      comments={(comments ?? []) as ScriptComment[]}
      categoryLabel={categoryLabel}
    />
  );
}
