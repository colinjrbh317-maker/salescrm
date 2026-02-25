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

interface EnrichmentLogEntry {
  step: string;
  outcome: string;
  detail: string | null;
  timestamp: string;
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
  linkedin: string | null;
  linkedin_company: string | null;
  google_rating: number | null;
  review_count: number | null;
  composite_score: number | null;
  has_website: boolean | null;
}

interface EnrichResult {
  id: string;
  owner_name: string | null;
  owner_email: string | null;
  website: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  linkedin: string | null;
  linkedin_company: string | null;
  instagram_followers: number | null;
  tiktok_followers: number | null;
  facebook_followers: number | null;
  ai_briefing: Record<string, unknown> | null;
  sources: string[];
  website_scores: WebsiteScores | null;
  website_analysis: WebsiteAnalysis | null;
  enrichment_log: EnrichmentLogEntry[];
  permanently_closed: boolean;
  // Phase 1 enrichment
  google_place_id: string | null;
  google_hours: PlacesResult["opening_hours"];
  google_rating: number | null;
  google_review_count: number | null;
  tech_stack: string[];
  is_parked_domain: boolean;
  review_sentiment: ReviewSentimentResult | null;
  competitor_data: CompetitorData[];
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

async function searchGoogle(query: string): Promise<{ results: SerperResult[]; rawText: string; permanentlyClosed: boolean }> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.log("[Enrich] No SERPER_API_KEY — skipping Google search layer");
    return { results: [], rawText: "", permanentlyClosed: false };
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
      return { results: [], rawText: "", permanentlyClosed: false };
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
    let permanentlyClosed = false;
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      kgText = `\n[Google Knowledge Graph]\nTitle: ${kg.title || ""}\nType: ${kg.type || ""}\nDescription: ${kg.description || ""}\nPhone: ${kg.phone || ""}\nAddress: ${kg.address || ""}\nWebsite: ${kg.website || ""}\n`;
      if (kg.attributes) {
        kgText += `Attributes: ${JSON.stringify(kg.attributes)}\n`;
      }

      // Detect permanently closed businesses
      const kgString = JSON.stringify(kg).toLowerCase();
      if (
        kgString.includes("permanently closed") ||
        kgString.includes("permanently_closed") ||
        kg.type?.toLowerCase().includes("closed")
      ) {
        permanentlyClosed = true;
        kgText += `\nSTATUS: PERMANENTLY CLOSED\n`;
      }
    }

    // Also check organic snippets for "permanently closed"
    if (!permanentlyClosed) {
      for (const r of organic) {
        const snippet = (r.snippet || "").toLowerCase();
        if (snippet.includes("permanently closed") || snippet.includes("permanently shut")) {
          permanentlyClosed = true;
          break;
        }
      }
    }

    const rawText =
      organic.map((r) => `[${r.title}] ${r.snippet} (${r.link})`).join("\n") + kgText;

    return { results: organic, rawText, permanentlyClosed };
  } catch (error) {
    console.error("[Enrich] Serper search error:", error);
    return { results: [], rawText: "", permanentlyClosed: false };
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

// ─── Layer 2.5: LinkedIn Search via Serper ────────────────────

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

function isLinkedInPriority(category: string | null, leadType: string): boolean {
  if (leadType === "podcast" || leadType === "creator") return true;
  if (!category) return false;
  const lower = category.toLowerCase();
  return LINKEDIN_PRIORITY_CATEGORIES.some((kw) => lower.includes(kw));
}

async function searchLinkedIn(
  leadName: string,
  ownerName: string | null,
  city: string | null
): Promise<{ personal: SerperResult | null; company: SerperResult | null; rawText: string }> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return { personal: null, company: null, rawText: "" };

  const personalQuery = `"${ownerName || leadName}" "${city || ""}" site:linkedin.com/in`;
  const companyQuery = `"${leadName}" "${city || ""}" site:linkedin.com/company`;

  const [personalRes, companyRes] = await Promise.all([
    searchGoogle(personalQuery),
    searchGoogle(companyQuery),
  ]);

  const personal = personalRes.results.find((r) => r.link.includes("linkedin.com/in/")) || null;
  const company = companyRes.results.find((r) => r.link.includes("linkedin.com/company/")) || null;

  const parts: string[] = [];
  if (personal) parts.push(`[LinkedIn Personal] ${personal.title} — ${personal.link}\n${personal.snippet}`);
  if (company) parts.push(`[LinkedIn Company] ${company.title} — ${company.link}\n${company.snippet}`);

  return { personal, company, rawText: parts.join("\n\n") };
}

// ─── Google Places API ──────────────────────────────────────

interface PlacesResult {
  place_id: string;
  name: string;
  formatted_address: string | null;
  formatted_phone_number: string | null;
  international_phone_number: string | null;
  website: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  business_status: string | null;
  opening_hours: {
    open_now?: boolean;
    periods?: { open: { day: number; time: string }; close?: { day: number; time: string } }[];
    weekday_text?: string[];
  } | null;
  reviews: { author_name: string; rating: number; text: string; time: number }[];
}

async function searchGooglePlaces(
  businessName: string,
  city: string | null
): Promise<PlacesResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log("[Enrich] No GOOGLE_PLACES_API_KEY — skipping Places layer");
    return null;
  }

  try {
    // Step 1: Text Search to find the place
    const query = `${businessName} ${city || ""}`.trim();
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      console.error(`[Enrich] Places Text Search error: ${searchRes.status}`);
      return null;
    }

    const searchData = await searchRes.json();
    if (!searchData.results || searchData.results.length === 0) {
      return null;
    }

    const placeId = searchData.results[0].place_id;

    // Step 2: Place Details for full data
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status,opening_hours,reviews&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    if (!detailsRes.ok) {
      console.error(`[Enrich] Places Details error: ${detailsRes.status}`);
      return null;
    }

    const detailsData = await detailsRes.json();
    const place = detailsData.result;
    if (!place) return null;

    return {
      place_id: place.place_id || placeId,
      name: place.name || businessName,
      formatted_address: place.formatted_address || null,
      formatted_phone_number: place.formatted_phone_number || null,
      international_phone_number: place.international_phone_number || null,
      website: place.website || null,
      rating: place.rating || null,
      user_ratings_total: place.user_ratings_total || null,
      business_status: place.business_status || null,
      opening_hours: place.opening_hours || null,
      reviews: (place.reviews || []).map((r: { author_name: string; rating: number; text: string; time: number }) => ({
        author_name: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.time,
      })),
    };
  } catch (error) {
    console.error("[Enrich] Google Places error:", error);
    return null;
  }
}

// ─── Competitor Comparison via Google Places ─────────────────

interface CompetitorData {
  name: string;
  rating: number | null;
  review_count: number | null;
  has_website: boolean;
  address: string | null;
}

async function searchCompetitors(
  category: string | null,
  city: string | null,
  excludeName: string
): Promise<CompetitorData[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !category || !city) return [];

  try {
    const query = `${category} in ${city}`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];

    const data = await res.json();
    const results = (data.results || []) as {
      name: string;
      rating?: number;
      user_ratings_total?: number;
      website?: string;
      formatted_address?: string;
    }[];

    // Filter out the lead itself and take top 5
    return results
      .filter((r) => r.name.toLowerCase() !== excludeName.toLowerCase())
      .slice(0, 5)
      .map((r) => ({
        name: r.name,
        rating: r.rating || null,
        review_count: r.user_ratings_total || null,
        has_website: !!r.website,
        address: r.formatted_address || null,
      }));
  } catch (error) {
    console.error("[Enrich] Competitor search error:", error);
    return [];
  }
}

// ─── Website Dead-Check (Parked / Placeholder Detection) ────

function isParkedDomain(html: string, url: string): boolean {
  const lower = html.toLowerCase();
  const text = stripHtmlTags(html).toLowerCase();
  const textLength = text.replace(/\s+/g, "").length;

  // Very short pages are likely parked (under 200 chars of actual content)
  if (textLength < 200 && !lower.includes("<form")) {
    return true;
  }

  // Common parked domain phrases
  const parkedPhrases = [
    "this domain is for sale",
    "buy this domain",
    "domain is parked",
    "this domain may be for sale",
    "domain parking",
    "this website is for sale",
    "is available for purchase",
    "domain has expired",
    "this site is under construction",
    "coming soon",
    "website expired",
    "renew your domain",
    "this page is parked",
    "hugedomains.com",
    "godaddy.com/forsale",
    "sedoparking",
    "domainmarket.com",
    "afternic.com",
    "dan.com",
  ];

  const matchCount = parkedPhrases.filter((phrase) => text.includes(phrase)).length;
  // If 2+ phrases match, it's almost certainly parked
  if (matchCount >= 2) return true;
  // Single match + very short content = parked
  if (matchCount >= 1 && textLength < 500) return true;

  // GoDaddy parking page pattern
  if (lower.includes("parked-content") || lower.includes("parking-lander")) {
    return true;
  }

  return false;
}

// ─── Tech Stack Detection ───────────────────────────────────

function detectTechStack(html: string): string[] {
  const stack: string[] = [];
  const lower = html.toLowerCase();

  // CMS / Website Builders
  if (/wp-content|wp-includes|wordpress/i.test(html)) stack.push("WordPress");
  if (/wix\.com|wixsite\.com|X-Wix/i.test(html)) stack.push("Wix");
  if (/squarespace\.com|squarespace-cdn/i.test(html)) stack.push("Squarespace");
  if (/shopify\.com|cdn\.shopify/i.test(html)) stack.push("Shopify");
  if (/weebly\.com/i.test(html)) stack.push("Weebly");
  if (/webflow\.com|webflow/i.test(html)) stack.push("Webflow");
  if (/godaddysites\.com|godaddy\.com\/websites/i.test(html)) stack.push("GoDaddy Builder");
  if (/duda\.co/i.test(html)) stack.push("Duda");

  // JS Frameworks (check meta generator + script patterns)
  if (lower.includes("__next") || lower.includes("_next/static")) stack.push("Next.js");
  if (lower.includes("__nuxt") || lower.includes("/_nuxt/")) stack.push("Nuxt.js");
  if (lower.includes("react") && (lower.includes("react-dom") || lower.includes("__reactfiber"))) {
    if (!stack.includes("Next.js")) stack.push("React");
  }
  if (/ng-version|angular/i.test(html)) stack.push("Angular");
  if (lower.includes("vue") && (lower.includes("__vue") || lower.includes("v-cloak"))) stack.push("Vue.js");

  // CSS frameworks
  if (/bootstrap/i.test(html)) stack.push("Bootstrap");
  if (/tailwindcss|tailwind/i.test(html)) stack.push("Tailwind CSS");

  // Analytics
  if (/google-analytics|gtag|googletagmanager/i.test(html)) stack.push("Google Analytics");
  if (/facebook\.net\/.*fbevents|fbq\(/i.test(html)) stack.push("Facebook Pixel");

  // Meta generator tag
  const generatorMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i);
  if (generatorMatch) {
    const gen = generatorMatch[1];
    if (!stack.some((s) => gen.toLowerCase().includes(s.toLowerCase()))) {
      stack.push(gen);
    }
  }

  return [...new Set(stack)];
}

// ─── Review Sentiment Analysis (via Claude) ─────────────────

interface ReviewSentimentResult {
  average_rating: number;
  total_reviews: number;
  positive_themes: string[];
  negative_themes: string[];
  talking_points: string[];
}

async function analyzeReviewSentiment(
  reviews: { author_name: string; rating: number; text: string }[],
  businessName: string
): Promise<ReviewSentimentResult | null> {
  if (reviews.length === 0) return null;

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  // If we have very few reviews or they're all short, do basic analysis without Claude
  const hasSubstantiveReviews = reviews.some((r) => r.text.length > 30);
  if (!hasSubstantiveReviews) {
    return {
      average_rating: Math.round(avgRating * 10) / 10,
      total_reviews: reviews.length,
      positive_themes: [],
      negative_themes: [],
      talking_points: reviews.length < 5
        ? [`Only ${reviews.length} reviews — opportunity to help them get more`]
        : [],
    };
  }

  try {
    const anthropic = await getAnthropic();
    const reviewText = reviews
      .map((r) => `[${r.rating}/5] ${r.text}`)
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Analyze these Google reviews for "${businessName}". Return ONLY a JSON object (no markdown, no explanation):

${reviewText}

{
  "positive_themes": ["theme 1", "theme 2"],
  "negative_themes": ["theme 1", "theme 2"],
  "talking_points": ["1-sentence sales talking point based on reviews", "another talking point"]
}

Rules:
- positive_themes: recurring praise patterns (max 4)
- negative_themes: recurring complaints (max 4)
- talking_points: 2-4 actionable insights a salesperson can reference when cold calling. E.g., "Customers love their fast response time — mention you can help maintain that reputation online" or "Several reviews mention outdated website — direct pain point for web design pitch"`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      average_rating: Math.round(avgRating * 10) / 10,
      total_reviews: reviews.length,
      positive_themes: Array.isArray(parsed.positive_themes) ? parsed.positive_themes : [],
      negative_themes: Array.isArray(parsed.negative_themes) ? parsed.negative_themes : [],
      talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points : [],
    };
  } catch (error) {
    console.error("[Enrich] Review sentiment analysis error:", error);
    return {
      average_rating: Math.round(avgRating * 10) / 10,
      total_reviews: reviews.length,
      positive_themes: [],
      negative_themes: [],
      talking_points: [],
    };
  }
}

// ─── Website Quality Analysis (ported from analyze.py + score.py) ─────

interface WebsiteAnalysis {
  has_website: boolean;
  ssl_valid: boolean;
  mobile_friendly: boolean;
  content_freshness: string | null;
  has_meta_description: boolean;
  has_cta: boolean;
  has_contact_form: boolean;
  has_social_links: boolean;
  load_time_ms: number;
}

interface WebsiteScores {
  composite_score: number;
  technical_score: number;
  content_score: number;
  mobile_score: number;
  presence_score: number;
  design_score: number;
}

async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const result: WebsiteAnalysis = {
    has_website: true,
    ssl_valid: false,
    mobile_friendly: false,
    content_freshness: null,
    has_meta_description: false,
    has_cta: false,
    has_contact_form: false,
    has_social_links: false,
    load_time_ms: 0,
  };

  const httpsUrl = url.startsWith("https") ? url : url.replace("http://", "https://");
  const startTime = Date.now();

  // Try HTTPS first (checks SSL)
  let html = await fetchPage(httpsUrl, 10000);
  if (html) {
    result.ssl_valid = true;
  } else {
    // Fall back to HTTP
    const httpUrl = url.startsWith("http") ? url : `http://${url}`;
    html = await fetchPage(httpUrl, 10000);
  }

  result.load_time_ms = Date.now() - startTime;

  if (!html) {
    result.has_website = false;
    return result;
  }

  const lowerHtml = html.toLowerCase();

  // Viewport meta (mobile-friendly indicator)
  result.mobile_friendly = /name=["']viewport["']/.test(lowerHtml);

  // Meta description
  result.has_meta_description = /name=["']description["']/.test(lowerHtml) && /content=["'][^"']+["']/.test(lowerHtml);

  // CTA elements
  const ctaPatterns = /contact\s*us|get\s*a?\s*quote|book\s*(now|online|appointment)|schedule|free\s*(estimate|consultation|quote)|call\s*(now|us|today)|request\s*(a\s*)?(quote|estimate)|sign\s*up|get\s*started/i;
  const pageText = stripHtmlTags(html);
  result.has_cta = ctaPatterns.test(pageText) || /<button/i.test(html);

  // Contact form
  result.has_contact_form = /<form[\s>]/i.test(html);

  // Social media links
  result.has_social_links = /facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|linkedin\.com/i.test(html);

  // Content freshness — copyright year
  const yearMatch = pageText.match(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i);
  if (yearMatch) {
    result.content_freshness = yearMatch[1];
  } else {
    // Check for recent year anywhere in page
    const recentYears = pageText.match(/20[2-3]\d/g);
    if (recentYears) {
      result.content_freshness = recentYears.sort().pop() || null;
    }
  }

  return result;
}

function computeScores(
  analysis: WebsiteAnalysis,
  lead: { website: string | null; google_rating: number | null; review_count: number | null; instagram: string | null; tiktok: string | null; facebook: string | null }
): WebsiteScores {
  // Technical score (0-100)
  let technical = 0;
  if (analysis.ssl_valid) technical += 25;
  if (analysis.load_time_ms > 0 && analysis.load_time_ms < 2000) technical += 25;
  else if (analysis.load_time_ms < 4000) technical += 15;
  else if (analysis.load_time_ms < 8000) technical += 5;
  technical += 25; // HTTP 200 (if we got html, it was 200)
  if (analysis.mobile_friendly) technical += 25;

  // Content score (0-100)
  let content = 0;
  if (analysis.has_meta_description) content += 15;
  if (analysis.has_cta) content += 25;
  if (analysis.has_contact_form) content += 20;
  if (analysis.has_social_links) content += 15;
  if (analysis.content_freshness) {
    const age = new Date().getFullYear() - parseInt(analysis.content_freshness);
    if (age <= 1) content += 25;
    else if (age <= 3) content += 15;
    else if (age <= 5) content += 5;
  }
  content = Math.min(content, 100);

  // Mobile score (0-100)
  const mobile = analysis.mobile_friendly ? 100 : 0;

  // Presence score (0-100)
  let presence = 0;
  if (lead.website) presence += 40;
  const rating = lead.google_rating || 0;
  if (rating >= 4.0) presence += 20;
  else if (rating >= 3.0) presence += 10;
  const reviews = lead.review_count || 0;
  if (reviews > 50) presence += 20;
  else if (reviews > 10) presence += 10;
  if (lead.instagram || lead.tiktok || lead.facebook) presence += 20;

  // Design score — default 50 (would need visual AI to score properly)
  const design = 50;

  // Composite (weighted average matching score.py weights)
  const composite = Math.round(
    technical * 0.20 +
    design * 0.25 +
    content * 0.20 +
    mobile * 0.15 +
    presence * 0.20
  );

  return {
    composite_score: composite,
    technical_score: technical,
    content_score: content,
    mobile_score: mobile,
    presence_score: presence,
    design_score: design,
  };
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

LOCATION VALIDATION (CRITICAL):
8. This business is in "${lead.city || "unknown city"}". For EVERY social profile (Instagram, Facebook, LinkedIn, TikTok), verify it actually belongs to this business in this city/metro area — NOT a similarly-named business elsewhere.
9. If a social profile mentions a DIFFERENT city (e.g., "Brooklyn" when the lead is in "Portland"), return null for that field and note the mismatch in location_mismatches.
10. Common name businesses are especially prone to wrong matches. When in doubt, return null rather than a wrong profile.

BUSINESS STATUS:
11. Check if the raw data contains ANY indication that this business is permanently closed, shut down, out of business, or defunct. Look for phrases like "permanently closed", "closed", "out of business", "no longer in business" in Google Knowledge Graph data, Yelp, or any source.

Known existing data:
- Website: ${lead.website || "none"}
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
  "website": "website URL found in data" or null if not found or already known,
  "phone": "phone number found" or null if not found or already known,
  "instagram": "@handle or URL" or null — MUST be in ${lead.city || "the same city"},
  "tiktok": "@handle or URL" or null — MUST be in ${lead.city || "the same city"},
  "facebook": "page or URL" or null — MUST be in ${lead.city || "the same city"},
  "linkedin": "personal LinkedIn profile URL" or null — MUST be in ${lead.city || "the same city"},
  "linkedin_company": "company LinkedIn page URL" or null — MUST be in ${lead.city || "the same city"},
  "instagram_followers": number or null if not in data,
  "tiktok_followers": number or null if not in data,
  "facebook_followers": number or null if not in data,
  "business_status": "open" or "permanently_closed" — based on evidence in the data,
  "location_mismatches": ["list of profiles rejected due to wrong city, e.g. 'facebook: found Brooklyn location, expected Portland'"] or [],
  "data_sources": ["list of source URLs where you found each piece of info"]
}`;
}

// ─── AI Briefing Prompts by Lead Type ────────────────────────

function getBriefingPrompt(lead: LeadData, ownerName: string | null, socialContext: string, smartTiming: string | null): string {
  const leadType = lead.lead_type || "business";
  const timingInstruction = smartTiming
    ? `\nSmart Call Timing Analysis: ${smartTiming}\nFor best_time_to_call, use the timing analysis above verbatim.`
    : "";

  if (leadType === "podcast") {
    return `Generate a sales briefing for reaching out to this podcast about potential sponsorship, guest appearances, or collaboration. Return ONLY a JSON object (no markdown, no explanation).

Podcast: ${lead.name}
Host: ${ownerName ?? "Unknown"}
Category: ${lead.category ?? "Unknown"}
City/Region: ${lead.city ?? "Unknown"}
Website: ${lead.website || "None"}
Phone: ${lead.phone || "None"}
Email: ${lead.email || "None"}
${socialContext}${timingInstruction}

Return this exact JSON structure:
{
  "summary": "2-3 sentence summary of the podcast, their audience, and why they'd be a good partner",
  "talking_points": ["point 1", "point 2", "point 3"],
  "recommended_channel": "cold_call" or "cold_email" or "social_dm",
  "channel_reasoning": "1 sentence explaining why this channel is best",
  "objections": ["likely objection 1", "likely objection 2"],
  "best_time_to_call": "${smartTiming || "e.g., Weekday mornings 9-11am"}",
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
${socialContext}${timingInstruction}

Return this exact JSON structure:
{
  "summary": "2-3 sentence summary of the creator, their content style, and why they'd be a good partner",
  "talking_points": ["point 1", "point 2", "point 3"],
  "recommended_channel": "cold_call" or "cold_email" or "social_dm",
  "channel_reasoning": "1 sentence explaining why this channel is best",
  "objections": ["likely objection 1", "likely objection 2"],
  "best_time_to_call": "${smartTiming || "e.g., Weekday mornings 9-11am"}",
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
${socialContext}${timingInstruction}

Return this exact JSON structure:
{
  "summary": "2-3 sentence summary of the business and why they need web design services",
  "talking_points": ["point 1", "point 2", "point 3"],
  "recommended_channel": "cold_call" or "cold_email" or "social_dm" or "walk_in",
  "channel_reasoning": "1 sentence explaining why this channel is best",
  "objections": ["likely objection 1", "likely objection 2"],
  "best_time_to_call": "${smartTiming || "e.g., Weekday mornings 9-11am"}"
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
    const log: EnrichmentLogEntry[] = [];
    const now = () => new Date().toISOString();
    let detectedClosed = false;

    // ── Layer 0: Google Places API (verified data) ──
    let placesResult: PlacesResult | null = null;
    let techStack: string[] = [];
    let parkedDomain = false;
    let reviewSentiment: ReviewSentimentResult | null = null;
    let competitors: CompetitorData[] = [];

    if (lead.lead_type === "business") {
      console.log(`[Enrich] Layer 0: Google Places for ${lead.name}`);
      placesResult = await searchGooglePlaces(lead.name, lead.city);

      if (placesResult) {
        dataSources.push("google_places");

        // Check for permanently closed via Places API (most reliable signal)
        if (placesResult.business_status === "CLOSED_PERMANENTLY") {
          detectedClosed = true;
          log.push({
            step: "Google Places",
            outcome: "PERMANENTLY CLOSED — confirmed by Google Places API",
            detail: `${placesResult.name} at ${placesResult.formatted_address}`,
            timestamp: now(),
          });
        } else {
          const verifiedFields: string[] = [];
          if (placesResult.formatted_phone_number) verifiedFields.push("phone");
          if (placesResult.formatted_address) verifiedFields.push("address");
          if (placesResult.opening_hours) verifiedFields.push("hours");
          if (placesResult.reviews.length > 0) verifiedFields.push(`${placesResult.reviews.length} reviews`);
          if (placesResult.rating) verifiedFields.push(`rating: ${placesResult.rating}`);

          log.push({
            step: "Google Places",
            outcome: `Found place — verified: ${verifiedFields.join(", ") || "basic info only"}`,
            detail: placesResult.business_status || null,
            timestamp: now(),
          });

          // Add Places data as a raw source for Claude extraction
          rawSources.push({
            source: "google_places",
            content: `[Google Places — Verified Data]\nName: ${placesResult.name}\nAddress: ${placesResult.formatted_address || "none"}\nPhone: ${placesResult.formatted_phone_number || "none"}\nWebsite: ${placesResult.website || "none"}\nRating: ${placesResult.rating || "none"} (${placesResult.user_ratings_total || 0} reviews)\nStatus: ${placesResult.business_status || "OPERATIONAL"}\n${placesResult.reviews.length > 0 ? `\nRecent Reviews:\n${placesResult.reviews.slice(0, 5).map((r) => `[${r.rating}/5] ${r.text.slice(0, 300)}`).join("\n")}` : ""}`,
          });
        }
      } else {
        log.push({
          step: "Google Places",
          outcome: "No Google Places result found",
          detail: null,
          timestamp: now(),
        });
      }
    }

    // If already detected as closed from Places, skip remaining layers
    if (detectedClosed) {
      return {
        id: lead.id,
        owner_name: null,
        owner_email: null,
        website: null,
        phone: null,
        instagram: null,
        tiktok: null,
        facebook: null,
        linkedin: null,
        linkedin_company: null,
        instagram_followers: null,
        tiktok_followers: null,
        facebook_followers: null,
        ai_briefing: null,
        sources: [...new Set(dataSources)],
        website_scores: null,
        website_analysis: null,
        enrichment_log: log,
        permanently_closed: true,
        google_place_id: placesResult?.place_id || null,
        google_hours: null,
        google_rating: null,
        google_review_count: null,
        tech_stack: [],
        is_parked_domain: false,
        review_sentiment: null,
        competitor_data: [],
      };
    }

    // ── Layer 1: Scrape lead's website ──
    if (lead.website) {
      console.log(`[Enrich] Layer 1: Scraping website for ${lead.name}`);
      const websiteData = await scrapeWebsite(lead.website);
      rawSources.push(...websiteData);
      if (websiteData.length > 0) {
        dataSources.push("website");
        const mainSource = websiteData[0]?.content || "";
        const emailCount = (mainSource.match(/Emails found: ([^\n]*)/)?.[1] || "none").split(", ").filter((e: string) => e !== "none").length;
        const phoneCount = (mainSource.match(/Phones found: ([^\n]*)/)?.[1] || "none").split(", ").filter((p: string) => p !== "none").length;
        log.push({ step: "Website Scrape", outcome: `Scraped ${lead.website} — found ${emailCount} emails, ${phoneCount} phones`, detail: websiteData.length > 1 ? `Also scraped ${websiteData.length - 1} sub-pages` : null, timestamp: now() });

        // Dead-check: Is this a parked/placeholder domain?
        const mainHtml = await fetchPage(lead.website.startsWith("http") ? lead.website : `https://${lead.website}`, 8000);
        if (mainHtml) {
          parkedDomain = isParkedDomain(mainHtml, lead.website);
          if (parkedDomain) {
            log.push({ step: "Website Dead-Check", outcome: "PARKED/PLACEHOLDER domain detected", detail: "Domain appears to be for sale, expired, or a placeholder page", timestamp: now() });
          } else {
            // Tech stack detection
            techStack = detectTechStack(mainHtml);
            if (techStack.length > 0) {
              log.push({ step: "Tech Stack", outcome: `Detected: ${techStack.join(", ")}`, detail: null, timestamp: now() });
            } else {
              log.push({ step: "Tech Stack", outcome: "No recognizable tech stack detected", detail: "Custom or unknown platform", timestamp: now() });
            }
          }
        }
      } else {
        log.push({ step: "Website Scrape", outcome: `Failed to scrape ${lead.website}`, detail: null, timestamp: now() });
      }
    } else {
      log.push({ step: "Website Scrape", outcome: "No website to scrape", detail: null, timestamp: now() });
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
      log.push({ step: "Google Search", outcome: `Searched '${queries[0]}' — ${searchData.results.length} results`, detail: searchData.permanentlyClosed ? "PERMANENTLY CLOSED detected in search results" : null, timestamp: now() });

      if (searchData.permanentlyClosed) {
        detectedClosed = true;
        log.push({ step: "Business Status", outcome: "Google indicates PERMANENTLY CLOSED", detail: "Detected from Knowledge Graph or search snippets", timestamp: now() });
      }
    } else {
      log.push({ step: "Google Search", outcome: "No results from Google search", detail: null, timestamp: now() });
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

    // ── Layer 2.5: LinkedIn Search ──
    let linkedinPersonalUrl: string | null = null;
    let linkedinCompanyUrl: string | null = null;

    if (isLinkedInPriority(lead.category, lead.lead_type)) {
      console.log(`[Enrich] Layer 2.5: LinkedIn search for ${lead.name}`);
      const linkedinResults = await searchLinkedIn(lead.name, null, lead.city);

      if (linkedinResults.personal) {
        linkedinPersonalUrl = linkedinResults.personal.link;
        log.push({
          step: "LinkedIn Search",
          outcome: `Found owner LinkedIn: ${linkedinResults.personal.link}`,
          detail: linkedinResults.personal.title,
          timestamp: now(),
        });
      }
      if (linkedinResults.company) {
        linkedinCompanyUrl = linkedinResults.company.link;
        log.push({
          step: "LinkedIn Search",
          outcome: `Found company LinkedIn: ${linkedinResults.company.link}`,
          detail: linkedinResults.company.title,
          timestamp: now(),
        });
      }
      if (!linkedinResults.personal && !linkedinResults.company) {
        log.push({ step: "LinkedIn Search", outcome: "No LinkedIn profiles found", detail: null, timestamp: now() });
      }

      if (linkedinResults.rawText) {
        rawSources.push({
          source: "linkedin_search",
          content: linkedinResults.rawText,
        });
        dataSources.push("linkedin_search");
      }
    } else {
      log.push({ step: "LinkedIn Search", outcome: "Skipped — category not LinkedIn-priority", detail: lead.category, timestamp: now() });
    }

    // ── Layer 3: Scrape top search result pages ──
    if (searchData.results.length > 0) {
      console.log(`[Enrich] Layer 3: Scraping ${Math.min(3, searchData.results.length)} search result pages`);
      const pageData = await scrapeSearchResults(searchData.results, 3);
      rawSources.push(...pageData);
      if (pageData.length > 0) {
        dataSources.push("directory_pages");
        log.push({ step: "Directory Scrape", outcome: `Scraped ${pageData.length} directory/search result pages`, detail: null, timestamp: now() });
      }
    }

    // ── Layer 4: Claude extracts structured data from raw sources ──
    console.log(`[Enrich] Layer 4: Claude extraction from ${rawSources.length} sources`);
    const anthropic = await getAnthropic();

    let ownerName: string | null = null;
    let ownerEmail: string | null = null;
    let discoveredWebsite: string | null = null;
    let phone: string | null = lead.phone;
    let instagram: string | null = lead.instagram;
    let tiktok: string | null = lead.tiktok;
    let facebook: string | null = lead.facebook;
    let linkedin: string | null = linkedinPersonalUrl || lead.linkedin;
    let linkedinCompany: string | null = linkedinCompanyUrl || lead.linkedin_company;
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

      const extractedFields: string[] = [];
      const notFound: string[] = [];

      try {
        const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          ownerName = parsed.owner_name || null;
          ownerEmail = parsed.owner_email || null;
          if (parsed.website && !lead.website) discoveredWebsite = parsed.website;
          if (parsed.phone && !phone) phone = parsed.phone;
          if (parsed.instagram && !instagram) instagram = parsed.instagram;
          if (parsed.tiktok && !tiktok) tiktok = parsed.tiktok;
          if (parsed.facebook && !facebook) facebook = parsed.facebook;
          if (parsed.linkedin && !linkedin) linkedin = parsed.linkedin;
          if (parsed.linkedin_company && !linkedinCompany) linkedinCompany = parsed.linkedin_company;
          if (typeof parsed.instagram_followers === "number")
            instagramFollowers = parsed.instagram_followers;
          if (typeof parsed.tiktok_followers === "number")
            tiktokFollowers = parsed.tiktok_followers;
          if (typeof parsed.facebook_followers === "number")
            facebookFollowers = parsed.facebook_followers;
          if (Array.isArray(parsed.data_sources)) {
            dataSources.push(...parsed.data_sources);
          }

          // Check business status from Claude extraction
          if (parsed.business_status === "permanently_closed") {
            detectedClosed = true;
            log.push({ step: "Business Status", outcome: "Claude extraction confirms PERMANENTLY CLOSED", detail: "Detected from source data analysis", timestamp: now() });
          }

          // Log location mismatches (profiles rejected by Claude for wrong city)
          if (Array.isArray(parsed.location_mismatches) && parsed.location_mismatches.length > 0) {
            log.push({
              step: "Location Validation",
              outcome: `Rejected ${parsed.location_mismatches.length} profile(s) for wrong city`,
              detail: parsed.location_mismatches.join("; "),
              timestamp: now(),
            });
          }

          // Build extraction log
          if (ownerName) extractedFields.push("owner_name");
          if (ownerEmail) extractedFields.push("owner_email");
          if (instagram) extractedFields.push("instagram");
          if (tiktok) extractedFields.push("tiktok");
          if (facebook) extractedFields.push("facebook");
          if (linkedin) extractedFields.push("linkedin");
          if (linkedinCompany) extractedFields.push("linkedin_company");
          if (discoveredWebsite) extractedFields.push("website");
          for (const field of ["owner_name", "owner_email", "instagram", "tiktok", "facebook", "linkedin"]) {
            if (!parsed[field]) notFound.push(field);
          }
        }
      } catch {
        console.error(
          `[Enrich] Failed to parse extraction for ${lead.name}`
        );
        log.push({ step: "Claude Extraction", outcome: "Failed to parse extraction response", detail: null, timestamp: now() });
      }

      log.push({
        step: "Claude Extraction",
        outcome: `Extracted: ${extractedFields.join(", ") || "nothing new"}`,
        detail: notFound.length > 0 ? `Could not find: ${notFound.join(", ")}` : null,
        timestamp: now(),
      });
    }

    // ── Layer 5: If website was discovered, scrape it and run quality analysis ──
    let websiteScores: WebsiteScores | null = null;
    let websiteAnalysisResult: WebsiteAnalysis | null = null;
    const effectiveWebsite = discoveredWebsite || lead.website;

    if (discoveredWebsite && !lead.website) {
      console.log(`[Enrich] Layer 5: Discovered website ${discoveredWebsite} for ${lead.name} — running analysis`);

      // Scrape the newly discovered website for additional contact info
      const newWebsiteData = await scrapeWebsite(discoveredWebsite);
      rawSources.push(...newWebsiteData);
      if (newWebsiteData.length > 0) dataSources.push("discovered_website");

      // Run website quality analysis
      websiteAnalysisResult = await analyzeWebsite(discoveredWebsite);

      // Compute scores with updated lead data
      websiteScores = computeScores(websiteAnalysisResult, {
        website: discoveredWebsite,
        google_rating: lead.google_rating,
        review_count: lead.review_count,
        instagram,
        tiktok,
        facebook,
      });

      log.push({ step: "Website Analysis", outcome: `Discovered website ${discoveredWebsite} — composite score: ${websiteScores.composite_score}/100`, detail: null, timestamp: now() });
      console.log(`[Enrich] Website analysis complete for ${lead.name}: composite=${websiteScores.composite_score}`);
    } else if (lead.website) {
      // Lead already had a website — re-analyze on re-enrich
      websiteAnalysisResult = await analyzeWebsite(lead.website);
      websiteScores = computeScores(websiteAnalysisResult, {
        website: lead.website,
        google_rating: lead.google_rating,
        review_count: lead.review_count,
        instagram,
        tiktok,
        facebook,
      });
      log.push({ step: "Website Analysis", outcome: `Existing website analyzed — score: ${websiteScores.composite_score}/100`, detail: null, timestamp: now() });
    }

    // ── Use Google Places verified phone if available ──
    if (placesResult?.formatted_phone_number && !phone) {
      phone = placesResult.formatted_phone_number;
      log.push({ step: "Phone Verification", outcome: `Using Google Places verified phone: ${phone}`, detail: null, timestamp: now() });
    }

    // ── Build enriched lead with all discovered data for briefing ──
    const enrichedLead: LeadData = {
      ...lead,
      website: effectiveWebsite || lead.website,
      has_website: !!(effectiveWebsite || lead.website),
      composite_score: websiteScores?.composite_score ?? lead.composite_score,
      phone: phone || lead.phone,
      email: lead.email,
      instagram: instagram || lead.instagram,
      tiktok: tiktok || lead.tiktok,
      facebook: facebook || lead.facebook,
      google_rating: placesResult?.rating ?? lead.google_rating,
      review_count: placesResult?.user_ratings_total ?? lead.review_count,
    };

    // ── Smart call timing from deterministic engine ──
    let smartTiming: string | null = null;
    try {
      const { classifyBusinessType, getWindowSummary } = await import("@/lib/call-timing");
      const businessType = classifyBusinessType(lead.category);
      const windows = getWindowSummary(businessType);
      smartTiming = windows
        .map((w) => `${w.dayLabel} ${w.timeRange} (${w.quality})`)
        .join(", ");
      log.push({ step: "Smart Timing", outcome: `Classified as '${businessType}'`, detail: smartTiming, timestamp: now() });
      console.log(`[Enrich] Smart timing for ${lead.name} (${businessType}): ${smartTiming}`);
    } catch (timingError) {
      console.error(`[Enrich] Smart timing failed for ${lead.name}:`, timingError);
      log.push({ step: "Smart Timing", outcome: "Timing analysis failed", detail: null, timestamp: now() });
    }

    // ── Generate AI briefing with enriched data ──
    const socialLines: string[] = [];
    if (enrichedLead.instagram)
      socialLines.push(
        `Instagram: ${enrichedLead.instagram}${instagramFollowers ? ` (~${instagramFollowers.toLocaleString()} followers)` : ""}`
      );
    if (enrichedLead.tiktok)
      socialLines.push(
        `TikTok: ${enrichedLead.tiktok}${tiktokFollowers ? ` (~${tiktokFollowers.toLocaleString()} followers)` : ""}`
      );
    if (enrichedLead.facebook)
      socialLines.push(
        `Facebook: ${enrichedLead.facebook}${facebookFollowers ? ` (~${facebookFollowers.toLocaleString()} followers)` : ""}`
      );
    if (linkedin)
      socialLines.push(`LinkedIn: ${linkedin}`);
    if (linkedinCompany)
      socialLines.push(`LinkedIn Company: ${linkedinCompany}`);
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
          content: getBriefingPrompt(enrichedLead, ownerName, socialContext, smartTiming),
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

    if (aiBriefing) {
      const recChannel = (aiBriefing as Record<string, unknown>).recommended_channel as string | undefined;
      log.push({ step: "AI Briefing", outcome: `Generated briefing — recommended channel: ${recChannel || "unknown"}`, detail: null, timestamp: now() });
    } else {
      log.push({ step: "AI Briefing", outcome: "Failed to generate briefing", detail: null, timestamp: now() });
    }

    // ── Review Sentiment Analysis ──
    if (placesResult && placesResult.reviews.length > 0) {
      console.log(`[Enrich] Analyzing ${placesResult.reviews.length} reviews for ${lead.name}`);
      reviewSentiment = await analyzeReviewSentiment(placesResult.reviews, lead.name);
      if (reviewSentiment) {
        log.push({
          step: "Review Sentiment",
          outcome: `Analyzed ${reviewSentiment.total_reviews} reviews — ${reviewSentiment.positive_themes.length} positive, ${reviewSentiment.negative_themes.length} negative themes`,
          detail: reviewSentiment.talking_points.length > 0 ? `Generated ${reviewSentiment.talking_points.length} talking points` : null,
          timestamp: now(),
        });
      }
    }

    // ── Competitor Comparison ──
    if (lead.lead_type === "business" && lead.category && lead.city) {
      console.log(`[Enrich] Searching competitors for ${lead.category} in ${lead.city}`);
      competitors = await searchCompetitors(lead.category, lead.city, lead.name);
      if (competitors.length > 0) {
        const avgRating = competitors.filter((c) => c.rating).reduce((sum, c) => sum + (c.rating || 0), 0) / competitors.filter((c) => c.rating).length;
        const withWebsite = competitors.filter((c) => c.has_website).length;
        log.push({
          step: "Competitor Analysis",
          outcome: `Found ${competitors.length} competitors — avg rating: ${avgRating.toFixed(1)}, ${withWebsite}/${competitors.length} have websites`,
          detail: competitors.map((c) => c.name).join(", "),
          timestamp: now(),
        });
      } else {
        log.push({ step: "Competitor Analysis", outcome: "No competitors found", detail: null, timestamp: now() });
      }
    }

    return {
      id: lead.id,
      owner_name: ownerName,
      owner_email: ownerEmail,
      website: discoveredWebsite,
      phone,
      instagram,
      tiktok,
      facebook,
      linkedin,
      linkedin_company: linkedinCompany,
      instagram_followers: instagramFollowers,
      tiktok_followers: tiktokFollowers,
      facebook_followers: facebookFollowers,
      ai_briefing: aiBriefing,
      sources: [...new Set(dataSources)],
      website_scores: websiteScores,
      website_analysis: websiteAnalysisResult,
      enrichment_log: log,
      permanently_closed: detectedClosed,
      google_place_id: placesResult?.place_id || null,
      google_hours: placesResult?.opening_hours || null,
      google_rating: placesResult?.rating || null,
      google_review_count: placesResult?.user_ratings_total || null,
      tech_stack: techStack,
      is_parked_domain: parkedDomain,
      review_sentiment: reviewSentiment,
      competitor_data: competitors,
    };
  } catch (error) {
    console.error(`[Enrich] Error enriching ${lead.name}:`, error);
    return {
      id: lead.id,
      owner_name: null,
      owner_email: null,
      website: null,
      phone: null,
      instagram: null,
      tiktok: null,
      facebook: null,
      linkedin: null,
      linkedin_company: null,
      instagram_followers: null,
      tiktok_followers: null,
      facebook_followers: null,
      ai_briefing: null,
      sources: [],
      website_scores: null,
      website_analysis: null,
      enrichment_log: [],
      permanently_closed: false,
      google_place_id: null,
      google_hours: null,
      google_rating: null,
      google_review_count: null,
      tech_stack: [],
      is_parked_domain: false,
      review_sentiment: null,
      competitor_data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Verify the caller is authenticated
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leadIds } = await request.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (leadIds.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 leads per batch" },
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
        "id, name, lead_type, category, city, website, phone, email, instagram, tiktok, facebook, linkedin, linkedin_company, google_rating, review_count, composite_score, has_website, assigned_to"
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

      // ── Auto-delete permanently closed businesses ──
      if (result.permanently_closed) {
        console.log(`[Enrich] ${lead.name} is PERMANENTLY CLOSED — deleting lead`);

        // Save the enrichment log before deleting so we have a record in console
        const closedLog = [...result.enrichment_log, {
          step: "Auto-Delete",
          outcome: "Lead deleted — business is permanently closed",
          detail: null,
          timestamp: new Date().toISOString(),
        }];
        console.log(`[Enrich] Deletion log for ${lead.name}:`, JSON.stringify(closedLog));

        // Delete related records first, then the lead
        await supabase.from("cadences").delete().eq("lead_id", lead.id);
        await supabase.from("activities").delete().eq("lead_id", lead.id);
        await supabase.from("leads").delete().eq("id", lead.id);
        continue;
      }

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

      // Website discovery — update URL and has_website flag
      if (result.website && !lead.website) {
        updateData.website = result.website;
        updateData.has_website = true;
      }

      // Website quality scores (from analysis of discovered or existing website)
      if (result.website_scores) {
        updateData.composite_score = result.website_scores.composite_score;
        updateData.technical_score = result.website_scores.technical_score;
        updateData.content_score = result.website_scores.content_score;
        updateData.mobile_score = result.website_scores.mobile_score;
        updateData.presence_score = result.website_scores.presence_score;
        updateData.design_score = result.website_scores.design_score;
      }

      // Website analysis flags
      if (result.website_analysis) {
        updateData.ssl_valid = result.website_analysis.ssl_valid;
        updateData.mobile_friendly = result.website_analysis.mobile_friendly;
        if (result.website_analysis.content_freshness) {
          updateData.content_freshness = result.website_analysis.content_freshness;
        }
      }

      // Social media updates (only if we found new data)
      if (result.instagram) updateData.instagram = result.instagram;
      if (result.tiktok) updateData.tiktok = result.tiktok;
      if (result.facebook) updateData.facebook = result.facebook;

      // LinkedIn
      if (result.linkedin) updateData.linkedin = result.linkedin;
      if (result.linkedin_company) updateData.linkedin_company = result.linkedin_company;

      // Phase 1: Google Places data
      if (result.google_place_id) updateData.google_place_id = result.google_place_id;
      if (result.google_hours) updateData.google_hours = result.google_hours;
      if (result.google_rating) updateData.google_rating = result.google_rating;
      if (result.google_review_count) updateData.review_count = result.google_review_count;

      // Phase 1: Tech stack, dead-check, sentiment, competitors
      if (result.tech_stack.length > 0) updateData.tech_stack = result.tech_stack;
      updateData.is_parked_domain = result.is_parked_domain;
      if (result.review_sentiment) updateData.review_sentiment = result.review_sentiment;
      if (result.competitor_data.length > 0) updateData.competitor_data = result.competitor_data;

      // Enrichment audit log
      if (result.enrichment_log.length > 0) {
        updateData.enrichment_log = result.enrichment_log;
      }

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

      // Cadence generation removed from enrichment — now triggered manually via "Generate Cadence" button on lead detail page
    }

    const enriched = results.filter((r) => !r.error && !r.permanently_closed).length;
    const deleted = results.filter((r) => r.permanently_closed).length;
    const withOwner = results.filter((r) => r.owner_name).length;
    const withEmail = results.filter((r) => r.owner_email).length;
    const withBriefing = results.filter((r) => r.ai_briefing).length;

    return NextResponse.json({
      success: true,
      total: results.length,
      enriched,
      deleted_closed: deleted,
      with_owner: withOwner,
      with_email: withEmail,
      with_briefing: withBriefing,
      results: results.map((r) => ({
        id: r.id,
        owner_name: r.owner_name,
        owner_email: r.owner_email,
        has_briefing: !!r.ai_briefing,
        permanently_closed: r.permanently_closed,
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
