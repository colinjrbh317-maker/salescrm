# Plan: LinkedIn Discovery + Enrichment Audit Log

## Context

The enrichment pipeline currently discovers website, phone, email, Instagram, TikTok, and Facebook — but not LinkedIn. Professional service leads (lawyers, accountants, consultants, etc.) are more likely to have LinkedIn as their primary social presence. Additionally, there's no visibility into what the enrichment API did, what decisions it made, or why — making it hard to debug or trust the results.

Two features:
1. **LinkedIn Discovery** — find both the owner's personal LinkedIn and the company page during enrichment
2. **Enrichment Audit Log** — collapsible log on each lead's detail page showing key decisions

---

## Feature 1: LinkedIn Discovery

### Database Changes

**New migration: `supabase/migrations/011_linkedin_enrichment_log.sql`**
```sql
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_company TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enrichment_log JSONB;
```

### Types Update (`lib/types.ts`)

Add to `Lead` interface:
- `linkedin: string | null`
- `linkedin_company: string | null`
- `enrichment_log: EnrichmentLogEntry[] | null`

Add new interface:
```ts
export interface EnrichmentLogEntry {
  step: string;
  outcome: string;
  detail: string | null;
  timestamp: string;
}
```

### Enrichment Route Changes (`app/api/enrich/route.ts`)

**1. Add LinkedIn-priority niche detection:**

```ts
const LINKEDIN_PRIORITY_CATEGORIES = [
  "lawyer", "law", "attorney", "legal",
  "accountant", "accounting", "cpa", "tax",
  "consultant", "consulting",
  "financial", "finance", "wealth", "investment",
  "insurance", "real estate", "realtor",
  "architect", "engineering", "engineer",
  "doctor", "dentist", "dental", "medical", "therapy", "therapist", "chiropractic",
  "marketing", "agency", "staffing", "recruiting", "hr",
  "it services", "tech", "saas", "software",
];
```

Simple check: `lead.category?.toLowerCase()` against these keywords. Also always search LinkedIn for creators and podcasters (professional outreach).

**2. Add LinkedIn search step (new Layer 2.5):**

Between the existing Google search (Layer 2) and search result scraping (Layer 3), add two targeted Serper queries:

- Owner personal profile: `"${ownerName || lead.name}" "${lead.city || ''}" site:linkedin.com/in`
- Company page: `"${lead.name}" "${lead.city || ''}" site:linkedin.com/company`

Parse from Serper results (no LinkedIn scraping needed):
- **URL**: The `link` field from the organic result
- **Headline/title**: The `title` field typically contains "Name - Title at Company | LinkedIn"
- **Snippet**: Often contains the person's headline/summary

Only fire these queries if the category matches a LinkedIn-priority niche OR if lead_type is "podcast" or "creator".

**3. Update the Claude extraction prompt:**

Add LinkedIn fields to `getExtractionPrompt()` output schema:
```json
"linkedin": "profile URL" or null,
"linkedin_company": "company page URL" or null
```

**4. Update `EnrichResult` interface and DB write:**

Add `linkedin` and `linkedin_company` to the result, and write them to the DB in the update section.

**5. Update `LeadData` interface** (local to enrich route):

Add linkedin fields so the briefing prompt can reference them.

### UI Changes

**`app/(dashboard)/leads/[id]/lead-header.tsx`** — Add LinkedIn display alongside existing social links (Instagram, TikTok, Facebook section at bottom of header card). Follow exact same pattern:

```tsx
{lead.linkedin && (
  <a href={lead.linkedin.startsWith("http") ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`}
     target="_blank" rel="noopener noreferrer"
     className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400">
    LinkedIn
  </a>
)}
```

**`app/(dashboard)/leads/new/page.tsx`** and **`lead-edit-form.tsx`** — Add LinkedIn field to the Social Media section of both forms.

---

## Feature 2: Enrichment Audit Log

### Log Collection (in `enrichLead()` function)

Build a `log: EnrichmentLogEntry[]` array throughout the function. Push entries at each decision point:

| Step | Example outcome |
|------|----------------|
| Layer 1: Website Scrape | "Scraped example.com — found 2 emails, 1 phone, Instagram link" |
| Layer 1: Sub-pages | "Scraped /contact — found owner email" |
| Layer 2: Google Search | "Searched 'Smith Law Portland owner' — 8 results" |
| Layer 2.5: LinkedIn Search | "Found owner LinkedIn: linkedin.com/in/john-smith — 'Partner at Smith Law'" or "No LinkedIn found" |
| Layer 3: Directory Scrape | "Scraped Yelp page — found phone, confirmed address" |
| Layer 4: Claude Extraction | "Extracted: owner_name, owner_email, instagram. Could not find: tiktok, facebook" |
| Layer 5: Website Analysis | "Discovered website example.com — composite score: 42/100" or "Existing website analyzed — score: 67/100" |
| Smart Timing | "Classified as 'restaurant' — best windows: Mon-Fri 2-4pm" |
| AI Briefing | "Generated briefing — recommended channel: cold_call" |
| Cadence | "Auto-created 5-step cadence" or "Skipped — existing cadence found" |

### DB Storage

Save log array as `enrichment_log` JSONB on the lead record alongside other enrichment data in the POST handler's update block.

### UI Component: `app/(dashboard)/leads/[id]/enrichment-log.tsx`

New **client component** (needs useState for collapse toggle):

- Collapsible section with header: "Enrichment Log" + timestamp of `enriched_at`
- Collapsed by default, click to expand
- Each log entry as a small row: step name (bold), outcome text, timestamp
- Color-coded: green dot for successful finds, gray for "not found", yellow for partial
- Only shown when `lead.enriched_at` exists

Pattern: Simple `useState(false)` toggle, same dark theme as other sections. No need for a Radix accordion — just a button that toggles a div.

### Lead Detail Page Integration

Add `<EnrichmentLog lead={lead} />` to the Overview tab in `leads/[id]/page.tsx`, below the Notes section.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/011_linkedin_enrichment_log.sql` | **NEW** — add linkedin, linkedin_company, enrichment_log columns |
| `lib/types.ts` | Add linkedin, linkedin_company, enrichment_log fields to Lead interface + EnrichmentLogEntry interface |
| `app/api/enrich/route.ts` | Add LinkedIn search, log collection, update DB writes |
| `app/(dashboard)/leads/[id]/lead-header.tsx` | Display LinkedIn links in social section |
| `app/(dashboard)/leads/[id]/enrichment-log.tsx` | **NEW** — collapsible enrichment log component |
| `app/(dashboard)/leads/[id]/page.tsx` | Import and render EnrichmentLog |
| `app/(dashboard)/leads/new/page.tsx` | Add LinkedIn field to new lead form |
| `app/(dashboard)/leads/[id]/lead-edit-form.tsx` | Add LinkedIn field to edit form |

## Verification

1. Run `npm run build` — zero type errors
2. Create a test lead with a professional category (e.g., "Lawyer" in "Portland")
3. Enrich the lead — verify LinkedIn URLs are found and stored
4. Check lead detail page — LinkedIn links display in header social section
5. Check lead detail page — enrichment log collapsible section shows all steps
6. Edit a lead — verify LinkedIn field is editable
7. Create a new lead — verify LinkedIn field is available
