import Link from "next/link";

interface ReadyToFireProps {
  emailCount: number;
  callCount: number;
  dmCount: number;
  overdueCount: number;
}

export function ReadyToFire({
  emailCount,
  callCount,
  dmCount,
  overdueCount,
}: ReadyToFireProps) {
  const allClear =
    emailCount === 0 && callCount === 0 && dmCount === 0 && overdueCount === 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">Ready to Fire</h2>

      {allClear ? (
        <p className="text-sm text-slate-400">
          All caught up! No pending touches.
        </p>
      ) : (
        <div className="space-y-3">
          {emailCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                <span className="mr-2">✉</span>
                {emailCount} emails ready to send
              </span>
              <Link
                href="/session"
                className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500"
              >
                Start Email Session →
              </Link>
            </div>
          )}

          {callCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                <span className="mr-2">☎</span>
                {callCount} calls queued
              </span>
              <Link
                href="/session"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                Start Call Session →
              </Link>
            </div>
          )}

          {dmCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                <span className="mr-2">💬</span>
                {dmCount} DMs queued
              </span>
              <Link
                href="/session"
                className="rounded-md bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-500"
              >
                Start DM Session →
              </Link>
            </div>
          )}

          {overdueCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-400">
                <span className="mr-2">⚠</span>
                {overdueCount} overdue touches
              </span>
              <Link
                href="/session"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
              >
                Clear Overdue →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
