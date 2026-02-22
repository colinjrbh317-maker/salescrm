import { NextRequest, NextResponse } from "next/server";

// Dynamic imports to avoid build-time evaluation when env vars are absent
async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAnthropic() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
}

interface LeadData {
  id: string;
  name: string;
  lead_type: string;
  category: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  google_rating: number | null;
  review_count: number | null;
  composite_score: number | null;
  has_website: boolean | null;
}

interface EnrichResult {
  id: string;
  owner_name: string | null;
  owner_email: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  instagram_followers: number | null;
  tiktok_followers: number | null;
  facebook_followers: number | null;
  ai_briefing: Record<string, unknown> | null;
  error?: string;
}

// ─── Contact Search Prompts by Lead Type ─────────────────────

function getContactSearchPrompt(lead: LeadData): string {
  const leadType = lead.lead_type || "business";

  if (leadType === "podcast") {
    return `Find the host and contact information for this podcast:

Podcast: ${lead.name}
City/Region: ${lead.city ?? "Unknown"}
Category: ${lead.category ?? "Unknown"}
Website: ${lead.website || "None"}
Known Email: ${lead.email || "None"}
Known Instagram: ${lead.instagram || "None"}
Known TikTok: ${lead.tiktok || "None"}
Known Facebook: ${lead.facebook || "None"}

Return ONLY a JSON object (no markdown, no explanation):
{
  "owner_name": "Host's full name" or null if not found,
  "owner_email": "email@example.com" or null if not found,
  "instagram": "@handle" or full URL or null if not found,
  "tiktok": "@handle" or full URL or null if not found,
  "facebook": "page name" or full URL or null if not found,
  "instagram_followers": approximate number or null if unknown,
  "tiktok_followers": approximate number or null if unknown,
  "facebook_followers": approximate number or null if unknown
}

CRITICAL: Only return real information you actually find or know. If you cannot find something, return null. Never fabricate data. For follower counts, approximate numbers are fine but don't guess randomly.`;
  }

  if (leadType === "creator") {
    return `Find contact and social media information for this content creator:

Creator: ${lead.name}
City/Region: ${lead.city ?? "Unknown"}
Niche/Category: ${lead.category ?? "Unknown"}
Website: ${lead.website || "None"}
Known Email: ${lead.email || "None"}
Known Instagram: ${lead.instagram || "None"}
Known TikTok: ${lead.tiktok || "None"}
Known Facebook: ${lead.facebook || "None"}

Return ONLY a JSON object (no markdown, no explanation):
{
  "owner_name": "Creator's real name" or null if not found,
  "owner_email": "email@example.com" or null if not found,
  "instagram": "@handle" or full URL or null if not found,
  "tiktok": "@handle" or full URL or null if not found,
  "facebook": "page name" or full URL or null if not found,
  "instagram_followers": approximate number or null if unknown,
  "tiktok_followers": approximate number or null if unknown,
  "facebook_followers": approximate number or null if unknown
}

CRITICAL: Only return real information you actually find or know. If you cannot find something, return null. Never fabricate data. For follower counts, approximate numbers are fine but don't guess randomly.`;
  }

  // Default: business
  return `Search for the owner, founder, or manager of this business and their contact email:

Business: ${lead.name}
City: ${lead.city ?? "Unknown"}
Category: ${lead.category ?? "Unknown"}
Website: ${lead.website || "None"}

Return ONLY a JSON object (no markdown, no explanation):
{
  "owner_name": "First Last" or null if not found,
  "owner_email": "email@example.com" or null if not found,
  "instagram": null,
  "tiktok": null,
  "facebook": null,
  "instagram_followers": null,
  "tiktok_followers": null,
  "facebook_followers": null
}

CRITICAL: Only return real information you actually find. If you cannot find the owner or email, return null for those fields. Never fabricate data.`;
}

// ─── AI Briefing Prompts by Lead Type ────────────────────────

function getBriefingPrompt(lead: LeadData, ownerName: string | null, socialContext: string): string {
  const leadType = lead.lead_type || "business";

  if (leadType === "podcast") {
    return `Generate a sales briefing for reaching out to this podcast about potential sponsorship, guest appearances, or collaboration. Return ONLY a JSON object (no markdown, no explanation).

Podcast: ${lead.name}
Host: ${ownerName ?? "Unknown"}
Category: ${lead.category ?? "Unknown"}
City/Region: ${lead.city ?? "Unknown"}
Website: ${lead.website || "None"}
Phone: ${lead.phone || "None"}
Email: ${lead.email || "None"}
${socialContext}

Return this exact JSON structure:
{
  "summary": "2-3 sentence summary of the podcast, their audience, and why they'd be a good partner",
  "talking_points": ["point 1", "point 2", "point 3"],
  "recommended_channel": "cold_call" or "cold_email" or "social_dm",
  "channel_reasoning": "1 sentence explaining why this channel is best",
  "objections": ["likely objection 1", "likely objection 2"],
  "best_time_to_call": "e.g., Weekday mornings 9-11am",
  "audience_profile": "Brief description of who listens to this podcast",
  "content_style": "Brief description of the podcast's style and format"
}

Base your recommended_channel on:
- If they have email → cold_email is often best for podcast hosts
- If they have social media DMs open → social_dm
- If they have a phone → cold_call as last resort

Make talking points specific to their podcast niche and audience.`;
  }

  if (leadType === "creator") {
    return `Generate a sales briefing for reaching out to this content creator about potential collaboration, sponsorship, or partnership. Return ONLY a JSON object (no markdown, no explanation).

Creator: ${lead.name}
Real Name: ${ownerName ?? "Unknown"}
Niche/Category: ${lead.category ?? "Unknown"}
City/Region: ${lead.city ?? "Unknown"}
Website: ${lead.website || "None"}
Phone: ${lead.phone || "None"}
Email: ${lead.email || "None"}
${socialContext}

Return this exact JSON structure:
{
  "summary": "2-3 sentence summary of the creator, their content style, and why they'd be a good partner",
  "talking_points": ["point 1", "point 2", "point 3"],
  "recommended_channel": "cold_call" or "cold_email" or "social_dm",
  "channel_reasoning": "1 sentence explaining why this channel is best",
  "objections": ["likely objection 1", "likely objection 2"],
  "best_time_to_call": "e.g., Weekday mornings 9-11am",
  "audience_profile": "Brief description of who follows this creator",
  "content_style": "Brief description of what content they make and their vibe"
}

Base your recommended_channel on:
- If they have social media → social_dm is usually best for creators
- If they have email → cold_email for more professional outreach
- If they have a phone → cold_call as last resort

Make talking points specific to their content niche and audience.`;
  }

  // Default: business
  return `Generate a sales briefing for a web design agency reaching out to this local business. Return ONLY a JSON object (no markdown, no explanation).

Business: ${lead.name}
Category: ${lead.category ?? "Unknown"}
City: ${lead.city ?? "Unknown"}
Website: ${lead.website || "None"}
Phone: ${lead.phone || "None"}
Email: ${lead.email || "None"}
Google Rating: ${lead.google_rating ?? "Unknown"}
Reviews: ${lead.review_count ?? "Unknown"}
Web Quality Score: ${lead.composite_score ?? "Unknown"}/100
Has Website: ${lead.has_website ? "Yes" : "No"}
Owner: ${ownerName ?? "Unknown"}

Return this exact JSON structure:
{
  "summary": "2-3 sentence summary of the business and why they need web design services",
  "talking_points": ["point 1", "point 2", "point 3"],
  "recommended_channel": "cold_call" or "cold_email" or "social_dm" or "walk_in",
  "channel_reasoning": "1 sentence explaining why this channel is best",
  "objections": ["likely objection 1", "likely objection 2"],
  "best_time_to_call": "e.g., Weekday mornings 9-11am"
}

Base your recommended_channel on:
- If they have a phone → cold_call is often best for local businesses
- If they have email but no phone → cold_email
- If they have social media but limited contact → social_dm
- If they're very local and walk-in friendly → walk_in

Make talking points specific to their business type and web presence needs.`;
}

// ─── Core Enrichment Function ────────────────────────────────

async function enrichLead(lead: LeadData): Promise<EnrichResult> {
  try {
    // Step 1: Search for contact/social info
    const anthropic = await getAnthropic();
    const searchResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: getContactSearchPrompt(lead) }],
    });

    let ownerName: string | null = null;
    let ownerEmail: string | null = null;
    let instagram: string | null = lead.instagram;
    let tiktok: string | null = lead.tiktok;
    let facebook: string | null = lead.facebook;
    let instagramFollowers: number | null = null;
    let tiktokFollowers: number | null = null;
    let facebookFollowers: number | null = null;

    const searchText =
      searchResponse.content[0].type === "text"
        ? searchResponse.content[0].text
        : "";

    try {
      const jsonMatch = searchText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        ownerName = parsed.owner_name || null;
        ownerEmail = parsed.owner_email || null;
        // Only update social if we found new data (don't overwrite existing)
        if (parsed.instagram && !instagram) instagram = parsed.instagram;
        if (parsed.tiktok && !tiktok) tiktok = parsed.tiktok;
        if (parsed.facebook && !facebook) facebook = parsed.facebook;
        // Follower counts
        if (typeof parsed.instagram_followers === "number") instagramFollowers = parsed.instagram_followers;
        if (typeof parsed.tiktok_followers === "number") tiktokFollowers = parsed.tiktok_followers;
        if (typeof parsed.facebook_followers === "number") facebookFollowers = parsed.facebook_followers;
      }
    } catch {
      console.error(`[Enrich] Failed to parse contact search for ${lead.name}`);
    }

    // Step 2: Build social context string for briefing
    const socialLines: string[] = [];
    if (instagram) socialLines.push(`Instagram: ${instagram}${instagramFollowers ? ` (~${instagramFollowers.toLocaleString()} followers)` : ""}`);
    if (tiktok) socialLines.push(`TikTok: ${tiktok}${tiktokFollowers ? ` (~${tiktokFollowers.toLocaleString()} followers)` : ""}`);
    if (facebook) socialLines.push(`Facebook: ${facebook}${facebookFollowers ? ` (~${facebookFollowers.toLocaleString()} followers)` : ""}`);
    const socialContext = socialLines.length > 0 ? socialLines.join("\n") : "No social media found";

    // Step 3: Generate AI briefing
    const briefingResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: getBriefingPrompt(lead, ownerName, socialContext) }],
    });

    let aiBriefing: Record<string, unknown> | null = null;

    const briefingText =
      briefingResponse.content[0].type === "text"
        ? briefingResponse.content[0].text
        : "";

    try {
      const jsonMatch = briefingText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiBriefing = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error(`[Enrich] Failed to parse briefing for ${lead.name}`);
    }

    return {
      id: lead.id,
      owner_name: ownerName,
      owner_email: ownerEmail,
      instagram,
      tiktok,
      facebook,
      instagram_followers: instagramFollowers,
      tiktok_followers: tiktokFollowers,
      facebook_followers: facebookFollowers,
      ai_briefing: aiBriefing,
    };
  } catch (error) {
    console.error(`[Enrich] Error enriching ${lead.name}:`, error);
    return {
      id: lead.id,
      owner_name: null,
      owner_email: null,
      instagram: null,
      tiktok: null,
      facebook: null,
      instagram_followers: null,
      tiktok_followers: null,
      facebook_followers: null,
      ai_briefing: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { leadIds } = await request.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const supabase = await getSupabase();
    const { data: leads, error: fetchError } = await supabase
      .from("leads")
      .select(
        "id, name, lead_type, category, city, website, phone, email, instagram, tiktok, facebook, google_rating, review_count, composite_score, has_website"
      )
      .in("id", leadIds);

    if (fetchError || !leads) {
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    const results: EnrichResult[] = [];
    for (const lead of leads) {
      const result = await enrichLead(lead as LeadData);
      results.push(result);

      // Write to DB immediately after each enrichment
      const updateData: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      };

      if (result.owner_name) updateData.owner_name = result.owner_name;
      if (result.owner_email) updateData.owner_email = result.owner_email;
      if (result.ai_briefing) updateData.ai_briefing = result.ai_briefing;
      if (result.ai_briefing?.recommended_channel) {
        updateData.ai_channel_rec = result.ai_briefing.recommended_channel;
      }

      // Social media updates (only if we found new data)
      if (result.instagram) updateData.instagram = result.instagram;
      if (result.tiktok) updateData.tiktok = result.tiktok;
      if (result.facebook) updateData.facebook = result.facebook;

      await supabase.from("leads").update(updateData).eq("id", lead.id);

      // Follower counts in separate call (columns may not exist yet)
      const followerData: Record<string, number> = {};
      if (result.instagram_followers) followerData.instagram_followers = result.instagram_followers;
      if (result.tiktok_followers) followerData.tiktok_followers = result.tiktok_followers;
      if (result.facebook_followers) followerData.facebook_followers = result.facebook_followers;

      if (Object.keys(followerData).length > 0) {
        await supabase.from("leads").update(followerData).eq("id", lead.id)
          .then(({ error }) => {
            if (error) console.log(`[Enrich] Follower columns not yet added — skipping follower counts for ${lead.name}`);
          });
      }
    }

    const enriched = results.filter((r) => !r.error).length;
    const withOwner = results.filter((r) => r.owner_name).length;
    const withBriefing = results.filter((r) => r.ai_briefing).length;

    return NextResponse.json({
      success: true,
      total: results.length,
      enriched,
      with_owner: withOwner,
      with_briefing: withBriefing,
      results: results.map((r) => ({
        id: r.id,
        owner_name: r.owner_name,
        has_briefing: !!r.ai_briefing,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error("[Enrich API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
