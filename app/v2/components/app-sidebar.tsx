"use client";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Home, Users, Calendar, Settings, LogOut, Briefcase } from "lucide-react"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from "@/lib/supabase/client"

export function AppSidebar({ userEmail, userName }: { userEmail: string, userName: string }) {
    const pathname = usePathname();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    const navItems = [
        { title: "Dashboard", url: "/v2/dashboard", icon: Home },
        { title: "Leads", url: "/v2/leads", icon: Users },
        { title: "Sessions", url: "/v2/sessions", icon: Calendar },
        { title: "Pipelines", url: "/v2/pipelines", icon: Briefcase },
    ]

    return (
        <Sidebar variant="inset" className="border-r border-border/40 bg-background">
            <SidebarHeader className="h-16 flex justify-center px-4 border-b border-border/40">
                <div className="flex items-center gap-2 font-semibold text-lg text-foreground">
                    <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary text-xs border border-primary/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">CRM</div>
                    <span className="tracking-tight">V2 Platform</span>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild isActive={pathname?.startsWith(item.url)}>
                                        <Link href={item.url} className={`font-medium transition-colors duration-200 ${pathname?.startsWith(item.url) ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-border/40 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-secondary-foreground border border-border/40">
                        {userName?.charAt(0) || userEmail?.charAt(0) || "U"}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium text-foreground truncate">{userName || "User"}</p>
                        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                </div>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton className="text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200" onClick={handleSignOut}>
                            <LogOut className="h-4 w-4" />
                            <span>Log out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
