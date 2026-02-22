import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CommentBoard } from "./comment-board";

export interface CommentWithScript {
  id: string;
  script_id: string;
  paragraph_index: number;
  paragraph_text: string;
  comment: string;
  author_id: string | null;
  status: string;
  created_at: string;
  script_title: string;
  script_file_path: string;
  script_category: string;
}

export default async function CommentsPage() {
  const supabase = await createClient();

  // Fetch all comments joined with their script data
  const { data: rawComments } = await supabase
    .from("script_comments")
    .select(
      `
      id,
      script_id,
      paragraph_index,
      paragraph_text,
      comment,
      author_id,
      status,
      created_at,
      scripts!inner (
        title,
        file_path,
        category
      )
    `
    )
    .order("created_at", { ascending: false });

  // Flatten the joined data into a single-level shape
  const comments: CommentWithScript[] = (rawComments ?? []).map(
    (row: Record<string, unknown>) => {
      const script = row.scripts as Record<string, unknown>;
      return {
        id: row.id as string,
        script_id: row.script_id as string,
        paragraph_index: row.paragraph_index as number,
        paragraph_text: row.paragraph_text as string,
        comment: row.comment as string,
        author_id: row.author_id as string | null,
        status: row.status as string,
        created_at: row.created_at as string,
        script_title: script.title as string,
        script_file_path: script.file_path as string,
        script_category: script.category as string,
      };
    }
  );

  return (
    <div>
      {/* Back link */}
      <Link
        href="/scripts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5 8.25 12l7.5-7.5"
          />
        </svg>
        Back to Scripts
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Comment Board</h1>
        <p className="mt-1 text-sm text-slate-400">
          All comments across scripts, organized for review and export
        </p>
      </div>

      <CommentBoard initialComments={comments} />
    </div>
  );
}
