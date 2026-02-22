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

// ─── Types ──────────────────────────────────────────────────

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
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  instagram_followers: number | null;
  tiktok_followers: number | null;
  facebook_followers: number | null;
  ai_briefing: Record<string, unknown> | null;
  sources: string[];
  error?: string;
}

interface RawDataSource {
  source: string;
  content: string;
}

// ─── Layer 1: Website Scraping ──────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const SOCIAL_PATTERNS = {
  instagram: /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/gi,
  tiktok: /tiktok\.com\/@([a-zA-Z0-9_.]+)/gi,
  facebook: /facebook\.com\/([a-zA-Z0-9_.]+)/gi,
  twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi,
  youtube: /youtube\.com\/(?:@|channel\/|c\/)([a-zA-Z0-9_\-]+)/gi,
};

async function fetchPage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 200_000); // Cap at 200KB to avoid memory issues
  } catch {
    return null;
  }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmails(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) || [];
  // Filter out common false positives
  return [...new Set(matches)].filter(
    (e) =>
      !e.endsWith(".png") &&
      !e.endsWith(".jpg") &&
      !e.endsWith(".gif") &&
      !e.endsWith(".svg") &&
      !e.includes("example.com") &&
      !e.includes("wixpress") &&
      !e.includes("sentry") &&
      !e.includes("googleapis") &&
      !e.includes("webpack")
  );
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches)].filter((p) => p.replace(/\D/g, "").length >= 10);
}

function extractSocialLinks(html: string): Record<string, string[]> {
  const results: Record<string, string[]> = {};
  for (const [platform, regex] of Object.entries(SOCIAL_PATTERNS)) {
    const matches: string[] = [];
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(html)) !== null) {
      const handle = match[1];
      if (
        handle &&
        !["share", "sharer", "intent", "home", "login", "signup", "help", "about", "pages"].includes(
          handle.toLowerCase()
        )
      ) {
        matches.push(handle);
      }
    }
    if (matches.length > 0) {
      results[platform] = [...new Set(matches)];
    }
  }
  return results;
}

function findContactPageUrls(html: string, baseUrl: string): string[] {
  const contactPatterns = /href=["']([^"']*(?:contact|about|team|staff|our-team|meet)[^"']*?)["']/gi;
  const urls: string[] = [];
  let match;
  while ((match = contactPatterns.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl).href;
      if (url.startsWith("http")) urls.push(url);
    } catch {
      // Invalid URL, skip
    }
  }
  return [...new Set(urls)].slice(0, 3); // Max 3 sub-pages
}

async function scrapeWebsite(website: string): Promise<RawDataSource[]> {
  const results: RawDataSource[] = [];
  const url = website.startsWith("http") ? website : `https://${website}`;

  // Fetch main page
  const mainHtml = await fetchPage(url);
  if (!mainHtml) return results;

  const mainText = stripHtmlTags(mainHtml);
  const emails = extractEmails(mainHtml);
  const phones = extractPhones(mainText);
  const socials = extractSocialLinks(mainHtml);

  results.push({
    source: `website:${url}`,
    content: `[Website Main Page]\nEmails found: ${emails.join(", ") || "none"}\nPhones found: ${phones.join(", ") || "none"}\nSocial links: ${JSON.stringify(socials)}\nPage text (first 3000 chars): ${mainText.slice(0, 3000)}`,
  });

  // Find and scrape contact/about pages
  const subPages = findContactPageUrls(mainHtml, url);
  for (const subUrl of subPages) {
    const subHtml = await fetchPage(subUrl);
    if (!subHtml) continue;
    const subText = stripHtmlTags(subHtml);
    const subEmails = extractEmails(subHtml);
    const subPhones = extractPhones(subText);

    results.push({
      source: `website:${subUrl}`,
      content: `[Contact/About Page]\nEmails found: ${subEmails.join(", ") || "none"}\nPhones found: ${subPhones.join(", ") || "none"}\nPage text (first 2000 chars): ${subText.slice(0, 2000)}`,
    });
  }

  return results;
}

// ─── Layer 2: Google Search via Serper.dev ───────────────────

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

async function searchGoogle(query: string): Promise<{ results: SerperResult[]; rawText: string }> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.log("[Enrich] No SERPER_API_KEY — skipping Google search layer");
    return { results: [], rawText: "" };
  }

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 8 }),
    });

    if (!res.ok) {
      console.error(`[Enrich] Serper API error: ${res.status}`);
      return { results: [], rawText: "" };
    }

    const data = await res.json();
    const organic: SerperResult[] = (data.organic || []).map(
      (r: { title: string; link: string; snippet: string }) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      })
    );

    // Also capture knowledge graph if available
    let kgText = "";
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      kgText = `\n[Google Knowledge Graph]\nTitle: ${kg.title || ""}\nType: ${kg.type || ""}\nDescription: ${kg.description || ""}\nPhone: ${kg.phone || ""}\nAddress: ${kg.address || ""}\nWebsite: ${kg.website || ""}\n`;
      if (kg.attributes) {
        kgText += `Attributes: ${JSON.stringify(kg.attributes)}\n`;
      }
    }

    const rawText =
      organic.map((r) => `[${r.title}] ${r.snippet} (${r.link})`).join("\n") + kgText;

    return { results: organic, rawText };
  } catch (error) {
    console.error("[Enrich] Serper search error:", error);
    return { results: [], rawText: "" };
  }
}

// ─── Layer 3: Scrape Top Search Result Pages ────────────────

async function scrapeSearchResults(results: SerperResult[], maxPages = 3): Promise<RawDataSource[]> {
  const sources: RawDataSource[] = [];
  const scraped = results
    .filter((r) => {
      const url = r.link.toLowerCase();
      // Prioritize directory/profile pages that typically have contact info
      return (
        url.includes("yelp.com") ||
        url.includes("facebook.com") ||
        url.includes("tripadvisor.com") ||
        url.includes("bbb.org") ||
        url.includes("chamber") ||
        url.includes("linkedin.com") ||
        url.includes("yellowpages") ||
        url.includes("manta.com") ||
        url.includes("instagram.com") ||
        !url.includes("google.com")
      );
    })
    .slice(0, maxPages);

  for (const result of scraped) {
    const html = await fetchPage(result.link, 6000);
    if (!html) continue;
    const text = stripHtmlTags(html);
    const emails = extractEmails(html);
    const phones = extractPhones(text);

    sources.push({
      source: `search_result:${result.link}`,
      content: `[${result.title}]\nURL: ${result.link}\nEmails found: ${emails.join(", ") || "none"}\nPhones found: ${phones.join(", ") || "none"}\nPage text (first 2000 chars): ${text.slice(0, 2000)}`,
    });
  }

  return sources;
}

// ─── Layer 4: Claude Extraction (parse, never generate) ─────

function getSearchQueries(lead: LeadData): string[] {
  const leadType = lead.lead_type || "business";
  const name = lead.name;
  const city = lead.city || "";

  if (leadType === "podcast") {
    return [
      `${name} podcast host contact`,
      `${name} podcast ${city} owner email`,
    ];
  }

  if (leadType === "creator") {
    return [
      `${name} ${city} content creator contact`,
      `${name} social media ${city} email`,
    ];
  }

  // Business — no strict quotes so Google can fuzzy match the name
  return [
    `${name} ${city} owner`,
    `${name} ${city} contact email phone`,
  ];
}

function getExtractionPrompt(lead: LeadData, rawSources: RawDataSource[]): string {
  const leadType = lead.lead_type || "business";
  const sourceText = rawSources
    .map((s) => `--- Source: ${s.source} ---\n${s.content}`)
    .join("\n\n");

  const typeLabel = leadType === "podcast" ? "podcast host" : leadType === "creator" ? "content creator" : "business owner";

  return `You are a data extraction assistant. Below is raw data collected from web scraping and Google search results about "${lead.name}" (${lead.city || "unknown city"}).

CRITICAL RULES:
1. ONLY extract information that is EXPLICITLY stated in the raw data below.
2. Do NOT generate, guess, or infer any contact information from your training data.
3. If information is not found in the data below, return null for that field.
4. For emails: only return emails that appear in the raw data. Never make up email addresses.
5. For owner/host name: only return names explicitly associated with this ${leadType} in the data.
6. For social handles: only return handles found in the data.
7. For follower counts: only return if explicitly stated in the data.

Known existing data:
- Phone: ${lead.phone || "none"}
- Email: ${lead.email || "none"}
- Instagram: ${lead.instagram || "none"}
- TikTok: ${lead.tiktok || "none"}
- Facebook: ${lead.facebook || "none"}

RAW DATA FROM WEB SOURCES:
${sourceText}

Return ONLY a JSON object (no markdown, no explanation):
{
  "owner_name": "the ${typeLabel}'s name" or null if not found in data,
  "owner_email": "email found in data" or null if not found,
  "phone": "phone number found" or null if not found or already known,
  "instagram": "@handle or URL" or null if not found,
  "tiktok": "@handle or URL" or null if not found,
  "facebook": "page or URL" or null if not found,
  "instagram_followers": number or null if not in data,
  "tiktok_followers": number or null if not in data,
  "facebook_followers": number or null if not in data,
  "data_sources": ["list of source URLs where you found each piece of info"]
}`;
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

// ─── Core Enrichment Function (4-Layer Cascade) ─────────────

async function enrichLead(lead: LeadData): Promise<EnrichResult> {
  try {
    const rawSources: RawDataSource[] = [];
    const dataSources: string[] = [];

    // ── Layer 1: Scrape lead's website ──
    if (lead.website) {
      console.log(`[Enrich] Layer 1: Scraping website for ${lead.name}`);
      const websiteData = await scrapeWebsite(lead.website);
      rawSources.push(...websiteData);
      if (websiteData.length > 0) dataSources.push("website");
    }

    // ── Layer 2: Google Search via Serper ──
    const queries = getSearchQueries(lead);
    console.log(`[Enrich] Layer 2: Google search for ${lead.name}`);
    const searchData = await searchGoogle(queries[0]);
    if (searchData.rawText) {
      rawSources.push({
        source: `google_search:${queries[0]}`,
        content: searchData.rawText,
      });
      dataSources.push("google_search");
    }

    // Second query for additional coverage
    if (queries[1]) {
      const searchData2 = await searchGoogle(queries[1]);
      if (searchData2.rawText) {
        rawSources.push({
          source: `google_search:${queries[1]}`,
          content: searchData2.rawText,
        });
      }
    }

    // ── Layer 3: Scrape top search result pages ──
    if (searchData.results.length > 0) {
      console.log(`[Enrich] Layer 3: Scraping ${Math.min(3, searchData.results.length)} search result pages`);
      const pageData = await scrapeSearchResults(searchData.results, 3);
      rawSources.push(...pageData);
      if (pageData.length > 0) dataSources.push("directory_pages");
    }

    // ── Layer 4: Claude extracts structured data from raw sources ──
    console.log(`[Enrich] Layer 4: Claude extraction from ${rawSources.length} sources`);
    const anthropic = await getAnthropic();

    let ownerName: string | null = null;
    let ownerEmail: string | null = null;
    let phone: string | null = lead.phone;
    let instagram: string | null = lead.instagram;
    let tiktok: string | null = lead.tiktok;
    let facebook: string | null = lead.facebook;
    let instagramFollowers: number | null = null;
    let tiktokFollowers: number | null = null;
    let facebookFollowers: number | null = null;

    if (rawSources.length > 0) {
      const extractionResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          { role: "user", content: getExtractionPrompt(lead, rawSources) },
        ],
      });

      const extractionText =
        extractionResponse.content[0].type === "text"
          ? extractionResponse.content[0].text
          : "";

      try {
        const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          ownerName = parsed.owner_name || null;
          ownerEmail = parsed.owner_email || null;
          if (parsed.phone && !phone) phone = parsed.phone;
          if (parsed.instagram && !instagram) instagram = parsed.instagram;
          if (parsed.tiktok && !tiktok) tiktok = parsed.tiktok;
          if (parsed.facebook && !facebook) facebook = parsed.facebook;
          if (typeof parsed.instagram_followers === "number")
            instagramFollowers = parsed.instagram_followers;
          if (typeof parsed.tiktok_followers === "number")
            tiktokFollowers = parsed.tiktok_followers;
          if (typeof parsed.facebook_followers === "number")
            facebookFollowers = parsed.facebook_followers;
          if (Array.isArray(parsed.data_sources)) {
            dataSources.push(...parsed.data_sources);
          }
        }
      } catch {
        console.error(
          `[Enrich] Failed to parse extraction for ${lead.name}`
        );
      }
    }

    // ── Generate AI briefing with enriched data ──
    const socialLines: string[] = [];
    if (instagram)
      socialLines.push(
        `Instagram: ${instagram}${instagramFollowers ? ` (~${instagramFollowers.toLocaleString()} followers)` : ""}`
      );
    if (tiktok)
      socialLines.push(
        `TikTok: ${tiktok}${tiktokFollowers ? ` (~${tiktokFollowers.toLocaleString()} followers)` : ""}`
      );
    if (facebook)
      socialLines.push(
        `Facebook: ${facebook}${facebookFollowers ? ` (~${facebookFollowers.toLocaleString()} followers)` : ""}`
      );
    const socialContext =
      socialLines.length > 0
        ? socialLines.join("\n")
        : "No social media found";

    const briefingResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: getBriefingPrompt(lead, ownerName, socialContext),
        },
      ],
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
      phone,
      instagram,
      tiktok,
      facebook,
      instagram_followers: instagramFollowers,
      tiktok_followers: tiktokFollowers,
      facebook_followers: facebookFollowers,
      ai_briefing: aiBriefing,
      sources: [...new Set(dataSources)],
    };
  } catch (error) {
    console.error(`[Enrich] Error enriching ${lead.name}:`, error);
    return {
      id: lead.id,
      owner_name: null,
      owner_email: null,
      phone: null,
      instagram: null,
      tiktok: null,
      facebook: null,
      instagram_followers: null,
      tiktok_followers: null,
      facebook_followers: null,
      ai_briefing: null,
      sources: [],
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
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!process.env.SERPER_API_KEY) {
      console.warn(
        "[Enrich] SERPER_API_KEY not set — Google search layer disabled. Add it for much better enrichment."
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
      if (result.phone && !lead.phone) updateData.phone = result.phone;
      if (result.ai_briefing) updateData.ai_briefing = result.ai_briefing;
      if (result.ai_briefing?.recommended_channel) {
        updateData.ai_channel_rec = result.ai_briefing.recommended_channel;
      }

      // Social media updates (only if we found new data)
      if (result.instagram) updateData.instagram = result.instagram;
      if (result.tiktok) updateData.tiktok = result.tiktok;
      if (result.facebook) updateData.facebook = result.facebook;

      await supabase.from("leads").update(updateData).eq("id", lead.id);

      // Follower counts
      const followerData: Record<string, number> = {};
      if (result.instagram_followers)
        followerData.instagram_followers = result.instagram_followers;
      if (result.tiktok_followers)
        followerData.tiktok_followers = result.tiktok_followers;
      if (result.facebook_followers)
        followerData.facebook_followers = result.facebook_followers;

      if (Object.keys(followerData).length > 0) {
        await supabase
          .from("leads")
          .update(followerData)
          .eq("id", lead.id)
          .then(({ error }) => {
            if (error)
              console.log(
                `[Enrich] Follower columns not yet added — skipping for ${lead.name}`
              );
          });
      }
    }

    const enriched = results.filter((r) => !r.error).length;
    const withOwner = results.filter((r) => r.owner_name).length;
    const withEmail = results.filter((r) => r.owner_email).length;
    const withBriefing = results.filter((r) => r.ai_briefing).length;

    return NextResponse.json({
      success: true,
      total: results.length,
      enriched,
      with_owner: withOwner,
      with_email: withEmail,
      with_briefing: withBriefing,
      results: results.map((r) => ({
        id: r.id,
        owner_name: r.owner_name,
        owner_email: r.owner_email,
        has_briefing: !!r.ai_briefing,
        sources: r.sources,
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
