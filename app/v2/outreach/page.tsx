import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { OutreachQueue } from "./outreach-queue";

export default async function OutreachPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch leads with pending cadence steps (due today or overdue)
    const { data: cadences } = await supabase
        .from("cadences")
        .select("*, leads(*)")
        .is("completed_at", null)
        .eq("skipped", false)
        .order("scheduled_at", { ascending: true });

    // Fetch recent draft messages to show pre-generated content
    const { data: draftMessages } = await supabase
        .from("messages")
        .select("id, lead_id, channel, subject, status, created_at")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(50);

    // Build queue items from cadence data
    const draftsByLead = new Map<string, number>();
    for (const msg of draftMessages ?? []) {
        draftsByLead.set(msg.lead_id, (draftsByLead.get(msg.lead_id) ?? 0) + 1);
    }

    return (
        <div className="flex h-screen flex-col bg-transparent">
            <header className="h-16 flex items-center justify-between px-8 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-10 w-full shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <SidebarTrigger />
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                            Outreach Queue
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            Daily outreach tasks
                        </p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="mx-auto max-w-5xl">
                    <OutreachQueue
                        cadences={(cadences ?? []) as Array<Record<string, unknown>>}
                        draftsByLead={Object.fromEntries(draftsByLead)}
                        currentUserId={user.id}
                    />
                </div>
            </div>
        </div>
    );
}
