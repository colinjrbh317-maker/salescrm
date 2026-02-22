import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Redirect to onboarding if not completed
  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userEmail={user.email ?? ""}
        userName={profile?.full_name ?? user.email ?? "User"}
        userRole={profile?.role ?? "salesperson"}
      />
      <main className="flex-1 overflow-y-auto bg-slate-900 p-6">
        {children}
      </main>
    </div>
  );
}
