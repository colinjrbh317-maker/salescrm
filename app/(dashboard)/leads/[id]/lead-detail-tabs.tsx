"use client";

import { useState, type ReactNode } from "react";

type Tab = "overview" | "activity" | "cadence" | "outreach";

interface LeadDetailTabsProps {
  overview: ReactNode;
  activity: ReactNode;
  cadence: ReactNode;
  outreach: ReactNode;
}

const TAB_CONFIG: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "activity", label: "Activity" },
  { key: "cadence", label: "Cadence" },
  { key: "outreach", label: "Outreach" },
];

export function LeadDetailTabs({ overview, activity, cadence, outreach }: LeadDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div>
      {/* Tab bar */}
      <div className="mt-4 flex items-center gap-1 border-b border-slate-700">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-emerald-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "overview" && overview}
        {activeTab === "activity" && activity}
        {activeTab === "cadence" && cadence}
        {activeTab === "outreach" && outreach}
      </div>
    </div>
  );
}
