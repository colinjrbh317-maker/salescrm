import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const STEP_NAMES = ["Welcome", "Meet the Team", "Claim Leads", "Set Goals", "Practice"];

export default async function OnboardingLayout({
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

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              S
            </div>
            <span className="text-lg font-semibold text-white">Sales CRM</span>
          </div>
          <span className="text-sm text-slate-400">Onboarding</span>
        </div>
      </header>

      {/* Step progress indicator */}
      <div className="border-b border-slate-800 px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2">
          {STEP_NAMES.map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-400">
                  {i + 1}
                </div>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {name}
                </span>
              </div>
              {i < STEP_NAMES.length - 1 && (
                <div className="h-px w-6 bg-slate-700 sm:w-10" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
