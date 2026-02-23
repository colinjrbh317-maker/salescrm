import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "./components/app-sidebar";
import { createClient } from "@/lib/supabase/server";

const fontSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
    title: 'CRM v2',
    description: 'Premium CRM Interface',
};

export default async function V2Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Fetch profile if user exists
    let profile = null;
    if (user) {
        const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
        profile = data;
    }

    return (
        <div className={`${fontSans.variable} font-sans min-h-screen bg-background text-foreground flex dark selection:bg-primary/30`}>
            <TooltipProvider>
                <SidebarProvider>
                    {user && <AppSidebar userEmail={user.email ?? ""} userName={profile?.full_name ?? ""} />}
                    <main className="flex-1 w-full bg-background border-l border-border/40">
                        {children}
                    </main>
                </SidebarProvider>
            </TooltipProvider>
        </div>
    );
}
