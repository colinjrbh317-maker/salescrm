import type { Lead } from "@/lib/types";
import LeadTypeIcon, { getLeadTypeLabel } from "./lead-type-icon";

interface LeadNameLinkProps {
  lead: Lead;
  onOpenLeadDetails: () => void;
  className?: string;
}

export default function LeadNameLink({
  lead,
  onOpenLeadDetails,
  className,
}: LeadNameLinkProps) {
  const leadTypeLabel = getLeadTypeLabel(lead.lead_type);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <LeadTypeIcon
        leadType={lead.lead_type}
        className="h-5 w-5 shrink-0 text-slate-300"
      />
      <a
        href={`/leads/${lead.id}`}
        onClick={(event) => {
          event.preventDefault();
          onOpenLeadDetails();
        }}
        className={`truncate text-left text-blue-300 underline decoration-blue-500/50 underline-offset-2 transition hover:text-blue-200 hover:decoration-blue-300 ${className ?? ""}`}
        title={`Open ${lead.name} details in split view`}
        aria-label={`Open ${leadTypeLabel} lead details for ${lead.name} in split view`}
      >
        {lead.name}
      </a>
    </div>
  );
}
