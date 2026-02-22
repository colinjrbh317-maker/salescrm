import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/lib/types";
import { PipelineBoard } from "./pipeline-board";

export default async function PipelinePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .not("pipeline_stage", "eq", "dead")
    .order("composite_score", { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-400">
          Visual overview of your sales pipeline
        </p>
      </div>

      <PipelineBoard
        leads={(leads ?? []) as Lead[]}
        currentUserId={user?.id ?? ""}
      />
    </div>
  );
}
