import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SessionLayout({
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
    <div className="min-h-screen bg-slate-950">
      {/* Thin top bar — minimal chrome for focus mode */}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-sm font-semibold tracking-wide text-slate-400">
          Sales CRM
        </span>
        <Link
          href="/"
          className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
        >
          Exit Session
        </Link>
      </header>

      <main>{children}</main>
    </div>
  );
}
