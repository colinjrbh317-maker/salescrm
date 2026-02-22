// Missing data check utility
// Checks a lead for missing critical fields and returns a list of warnings

import type { Lead } from "./types";

export interface MissingDataWarning {
  field: string;
  label: string;
}

export function checkMissingData(lead: Lead): MissingDataWarning[] {
  const warnings: MissingDataWarning[] = [];

  if (!lead.phone) warnings.push({ field: "phone", label: "Phone not found" });
  if (!lead.email) warnings.push({ field: "email", label: "Email not found" });
  if (!lead.owner_name) warnings.push({ field: "owner_name", label: "Owner name not found" });
  if (!lead.owner_email) warnings.push({ field: "owner_email", label: "Owner email not found" });
  if (!lead.website) warnings.push({ field: "website", label: "Website not found" });
  if (!lead.instagram) warnings.push({ field: "instagram", label: "Instagram not found" });
  if (!lead.tiktok) warnings.push({ field: "tiktok", label: "TikTok not found" });
  if (!lead.facebook) warnings.push({ field: "facebook", label: "Facebook not found" });

  return warnings;
}
