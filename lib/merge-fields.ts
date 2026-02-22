// Merge field replacement utility
// Replaces {{FIELD}} tokens in script content with actual lead data
// Unresolvable fields are returned with amber highlighting markers

import type { Lead } from "./types";

const FIELD_MAP: Record<string, (lead: Lead) => string | null> = {
  BUSINESS_NAME: (l) => l.name,
  NAME: (l) => l.name,
  CITY: (l) => l.city,
  ADDRESS: (l) => l.address,
  PHONE: (l) => l.phone,
  EMAIL: (l) => l.email,
  OWNER_EMAIL: (l) => l.owner_email,
  WEBSITE: (l) => l.website,
  OWNER_NAME: (l) => l.owner_name,
  CATEGORY: (l) => l.category,
  INSTAGRAM: (l) => l.instagram,
  TIKTOK: (l) => l.tiktok,
  FACEBOOK: (l) => l.facebook,
  GOOGLE_RATING: (l) => l.google_rating?.toString() ?? null,
  REVIEW_COUNT: (l) => l.review_count?.toString() ?? null,
  PRIORITY: (l) => l.priority,
  COMPOSITE_SCORE: (l) => l.composite_score?.toString() ?? null,
};

export interface MergeResult {
  text: string;
  unresolvedFields: string[];
}

export function mergeFields(template: string, lead: Lead): MergeResult {
  const unresolvedFields: string[] = [];

  const text = template.replace(/\{\{([^}]+)\}\}/g, (match, fieldName: string) => {
    const normalized = fieldName.trim().toUpperCase();
    const getter = FIELD_MAP[normalized];

    if (getter) {
      const value = getter(lead);
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }

    unresolvedFields.push(fieldName.trim());
    return match; // Keep the original {{FIELD}} for amber display
  });

  return { text, unresolvedFields };
}
