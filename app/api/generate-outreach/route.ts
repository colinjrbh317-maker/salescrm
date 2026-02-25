import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Channel-specific system prompt sections
const CHANNEL_GUIDELINES: Record<string, string> = {
  email: `CHANNEL: Cold Email
- Subject line: "Quick question" variant. Simple, curiosity-driven.
- 3-6 sentences TOTAL. Count them. If more than 6, cut.
- Use owner's first name in greeting (Hey Lindsey, Hey Mark).
- Sign off: Best, Colin then 540-739-5765 on its own line.
- PS line with a SPECIFIC fact about the business or owner from the data provided. Not generic social proof.
- No em dashes. No quotation marks. Commas, periods, and colons only.`,
  instagram: `CHANNEL: Instagram DM
- VERY short. 2-4 sentences max. People scan on mobile.
- Open with Hey or Hey there (never use a name on IG).
- Lead with a genuine compliment about their content/brand.
- The offer should feel like a natural extension of the compliment.
- Sign off: Just Colin. No phone number.
- Two-beat structure: observation/question, then credential and ask, separated by a line break.`,
  facebook: `CHANNEL: Facebook DM
- 3-5 sentences. Warm, neighborly tone.
- Use owner's first name when known (Hey Mark, Hey Sarah).
- Reference their Facebook page, reviews, community.
- Sign off: Just Colin. No phone number.
- Two-beat structure: observation/question, then credential and ask, separated by a line break.`,
  linkedin: `CHANNEL: LinkedIn DM
- Professional but not stiff. 3-5 sentences.
- Use owner's first name when known.
- Reference their business accomplishments or role.
- Frame the website as a business asset, not just design.
- Sign off: Just Colin. No phone number.
- Two-beat structure: observation/question, then credential and ask, separated by a line break.`,
};

function buildSystemPrompt(channel: string): string {
  const channelGuide = CHANNEL_GUIDELINES[channel] || CHANNEL_GUIDELINES.email;

  return `You are Colin Ryan's outreach writing assistant. You generate hyper-personalized cold outreach messages for his web design business.

THE CORE OFFER (non-negotiable elements):
- Brand new website, not a redesign, not a consultation
- Completely free, no deposit, no commitment
- They see the finished site, judge the real thing
- Only pay if they love it, zero risk

BUT: The full offer does NOT need to appear in every first message. Match the CTA to their situation:
- Clear website pain (bad site, no site, Google Sites) → Full Offer
- Strong visual brand with accessible material → Mockup Tease: "I mocked up a homepage already. Want to see it?"
- Soft pain (decent site, thriving business) → Conversation: "Worth a 10-minute call?" Do NOT include the free website offer.
- Question-based opener → Question close: "Curious if that's on your radar."

${channelGuide}

WRITING RULES (mandatory):
1. 2x1 Rule: Talk about THEM twice as much as you. Their world, their problem. You are a footnote.
2. Mirror, don't lecture: Open with something the owner already knows is true. Observable facts only, not market claims.
3. ONE personalization signal. Not two, not three. One sharp observation that bridges to the offer.
4. Restrained compliments: State the impressive fact, don't editorialize. No "That's real." or "That says something."
5. No diminishing language: No "sorry to bother", "don't want to take up your time", "I know you're busy".
6. Solutions, not features: No "responsive design" or "SEO optimization". They care about getting customers and looking professional.
7. Never say "I would love to". Use: "would you be open to".
8. No em dashes. No quotation marks. Commas, periods, and colons only.
9. No unverifiable market claims ("most people bounce when...", "customers are going to competitors...").
10. Do NOT extend facts into consequences ("which means...", "so when someone searches..."). State the fact, let the gap speak.

LOCAL CREDIBILITY (use ONLY for Blacksburg/Christiansburg/NRV leads):
Colin is a Virginia Tech student who builds websites for local businesses. Vary the phrasing every time.

BUSINESS NAME: Always use the short natural name people actually say. Drop LLC, Inc, Co. Drop generic category words when the name is distinctive without them.

OUTPUT FORMAT:
Return ONLY the message. For emails, put the subject line on the first line prefixed with "Subject: ", then a blank line, then the body. For DMs, just the message body. No explanations, no metadata.`;
}

function buildUserPrompt(
  lead: Record<string, unknown>,
  channel: string,
  cadencePosition: number,
  direction?: string | null
): string {
  const parts: string[] = [];

  parts.push(`Generate a ${channel === "email" ? "cold email" : `${channel} DM`} for this lead.`);

  if (cadencePosition > 1) {
    parts.push(`This is touch #${cadencePosition} in the cadence (a follow-up, not first touch).`);
  }

  if (direction) {
    parts.push(`Direction from user: ${direction}`);
  }

  parts.push(`\nLEAD DATA:`);
  parts.push(`Business: ${lead.name || "Unknown"}`);
  if (lead.owner_name) parts.push(`Owner: ${lead.owner_name}`);
  if (lead.category) parts.push(`Category: ${lead.category}`);
  if (lead.city) parts.push(`Location: ${lead.city}${lead.address ? `, ${lead.address}` : ""}`);
  if (lead.website) parts.push(`Website: ${lead.website}`);
  if (lead.email) parts.push(`Email: ${lead.email}`);
  if (lead.phone) parts.push(`Phone: ${lead.phone}`);

  // Scores
  const scores: string[] = [];
  if (lead.google_rating) scores.push(`Google: ${lead.google_rating}★ (${lead.review_count || 0} reviews)`);
  if (lead.design_score) scores.push(`Design: ${lead.design_score}/10`);
  if (lead.composite_score) scores.push(`Composite: ${lead.composite_score}`);
  if (lead.has_website === false) scores.push("NO WEBSITE");
  if (lead.is_parked_domain) scores.push("PARKED DOMAIN");
  if (scores.length > 0) parts.push(`Scores: ${scores.join(" | ")}`);

  // Social
  const social: string[] = [];
  if (lead.instagram) social.push(`IG: ${lead.instagram}${lead.instagram_followers ? ` (${lead.instagram_followers})` : ""}`);
  if (lead.facebook) social.push(`FB: ${lead.facebook}${lead.facebook_followers ? ` (${lead.facebook_followers})` : ""}`);
  if (lead.tiktok) social.push(`TikTok: ${lead.tiktok}${lead.tiktok_followers ? ` (${lead.tiktok_followers})` : ""}`);
  if (social.length > 0) parts.push(`Social: ${social.join(" | ")}`);

  // AI Briefing
  const briefing = lead.ai_briefing as Record<string, unknown> | null;
  if (briefing) {
    if (briefing.summary) parts.push(`\nAI BRIEFING: ${briefing.summary}`);
    if (briefing.talking_points && Array.isArray(briefing.talking_points)) {
      parts.push(`Talking Points: ${(briefing.talking_points as string[]).join("; ")}`);
    }
    if (briefing.audience_profile) parts.push(`Audience: ${briefing.audience_profile}`);
    if (briefing.content_style) parts.push(`Content Style: ${briefing.content_style}`);
  }

  // Review sentiment
  const sentiment = lead.review_sentiment as Record<string, unknown> | null;
  if (sentiment) {
    if (sentiment.positive_themes) parts.push(`Positive Reviews: ${(sentiment.positive_themes as string[]).join(", ")}`);
    if (sentiment.negative_themes) parts.push(`Negative Reviews: ${(sentiment.negative_themes as string[]).join(", ")}`);
  }

  // Tech stack
  if (lead.tech_stack && Array.isArray(lead.tech_stack) && (lead.tech_stack as string[]).length > 0) {
    parts.push(`Tech Stack: ${(lead.tech_stack as string[]).join(", ")}`);
  }

  // Notes
  if (lead.shared_notes) parts.push(`\nNotes: ${lead.shared_notes}`);

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      leadId,
      channel = "email",
      direction,
      parentMessageId,
    } = body as {
      leadId: string;
      channel: string;
      direction?: string;
      parentMessageId?: string;
    };

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch lead data
    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Determine cadence position
    const { data: latestCadence } = await supabase
      .from("cadences")
      .select("step_number, completed_at")
      .eq("lead_id", leadId)
      .order("step_number", { ascending: false })
      .limit(1)
      .single();

    let cadencePosition = 1;
    if (latestCadence) {
      cadencePosition = latestCadence.completed_at
        ? latestCadence.step_number + 1
        : latestCadence.step_number;
    }

    // Determine version if regenerating
    let version = 1;
    if (parentMessageId) {
      const { data: parent } = await supabase
        .from("messages")
        .select("version")
        .eq("id", parentMessageId)
        .single();
      if (parent) version = parent.version + 1;
    }

    // Generate with Claude
    const normalizedChannel = channel === "dm" ? "instagram" : channel;
    const systemPrompt = buildSystemPrompt(normalizedChannel);
    const userPrompt = buildUserPrompt(lead, normalizedChannel, cadencePosition, direction);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse subject from email output
    let subject: string | null = null;
    let messageBody = rawText.trim();

    if (normalizedChannel === "email" && messageBody.startsWith("Subject:")) {
      const lines = messageBody.split("\n");
      subject = lines[0].replace("Subject:", "").trim();
      // Remove subject line and blank line after it
      messageBody = lines
        .slice(1)
        .join("\n")
        .replace(/^\n+/, "")
        .trim();
    }

    // Determine CTA type from content
    let ctaType: string = "conversation";
    const lower = messageBody.toLowerCase();
    if (lower.includes("brand new") && lower.includes("free")) {
      ctaType = "full_offer";
    } else if (lower.includes("mocked up") || lower.includes("mockup")) {
      ctaType = "mockup_tease";
    } else if (
      lower.includes("on your radar") ||
      lower.includes("thought about")
    ) {
      ctaType = "question";
    }

    // Store in messages table
    const { data: message, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        user_id: user.id,
        channel: normalizedChannel,
        subject,
        body: messageBody,
        template_used: "claude-generated",
        cadence_step: cadencePosition,
        angle: direction || "auto-generated",
        cta_type: ctaType,
        research_highlights: {
          signals: [
            lead.ai_briefing
              ? "enrichment data used"
              : "minimal data available",
          ],
        },
        direction: direction || null,
        version,
        parent_message_id: parentMessageId || null,
        status: "draft",
      })
      .select()
      .single();

    if (insertError) {
      // Still return the generated message even if storage fails
      return NextResponse.json({
        leadId,
        channel: normalizedChannel,
        subject,
        body: messageBody,
        generated: true,
        stored: false,
        storageError: insertError.message,
      });
    }

    return NextResponse.json({
      leadId,
      channel: normalizedChannel,
      subject,
      body: messageBody,
      messageId: message.id,
      version,
      ctaType,
      cadenceStep: cadencePosition,
      generated: true,
      stored: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
