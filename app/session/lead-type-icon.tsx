import { Building2, Mic, UserCircle2 } from "lucide-react";
import type { LeadType } from "@/lib/types";

interface LeadTypeIconProps {
  leadType: LeadType;
  className?: string;
}

export function getLeadTypeLabel(leadType: LeadType): string {
  if (leadType === "podcast") return "Podcast";
  if (leadType === "creator") return "Creator";
  return "Business";
}

export default function LeadTypeIcon({ leadType, className }: LeadTypeIconProps) {
  if (leadType === "podcast") {
    return <Mic className={className} aria-hidden="true" />;
  }
  if (leadType === "creator") {
    return <UserCircle2 className={className} aria-hidden="true" />;
  }
  return <Building2 className={className} aria-hidden="true" />;
}
