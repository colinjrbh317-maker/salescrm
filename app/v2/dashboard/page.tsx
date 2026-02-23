import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LeadQueue } from "./lead-queue";

export default async function V2Dashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch all leads for queue
    const { data: allLeads } = await supabase
        .from("leads")
        .select("*")
        .not("pipeline_stage", "in", '("dead")')
        .order("composite_score", { ascending: true });

    return (
        <div className="flex h-screen flex-col bg-transparent">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-8 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-10 w-full shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <SidebarTrigger />
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                            Dashboard Overview
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prioritized terminal</p>
                    </div>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="mx-auto max-w-6xl">
                    <LeadQueue
                        leads={allLeads ?? []}
                        currentUserId={user.id}
                    />
                </div>
            </div>
        </div>
    );
}
