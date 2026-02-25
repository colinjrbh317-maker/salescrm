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

interface AICadenceStep {
  step_number: number;
  channel: string;
  day_offset: number;
  template_name: string;
  reasoning: string;
}

const VALID_CHANNELS = [
  "phone",
  "email",
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "in_person",
  "other",
] as const;

// ─── POST Handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Guard: check for required env vars
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase environment variables not configured" },
      { status: 500 }
    );
  }

  let body: { leadId?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { leadId, userId } = body;
  if (!leadId || !userId) {
    return NextResponse.json(
      { error: "leadId and userId are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await getSupabase();

    // ── Fetch lead data ──────────────────────────────────────
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "name, category, city, website, phone, email, instagram, facebook, tiktok, owner_name, ai_briefing, google_rating, review_count, composite_score"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // ── Detect available channels ────────────────────────────
    const { detectAvailableChannels } = await import("@/lib/cadence-generator");
    const available = detectAvailableChannels(lead);
    const availableList = Object.entries(available)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (availableList.length === 0) {
      return NextResponse.json(
        { error: "No contact channels available for this lead. Enrich the lead first." },
        { status: 400 }
      );
    }

    // ── Classify business type ───────────────────────────────
    const { classifyBusinessType, getNextBestWindow } = await import(
      "@/lib/call-timing"
    );
    const businessType = classifyBusinessType(lead.category);

    // ── Build the AI prompt ──────────────────────────────────
    const prompt = `You are a sales cadence strategist. Design an optimal outreach cadence for a sales rep contacting a specific local business lead.

LEAD PROFILE:
- Business Name: ${lead.name}
- Industry/Category: ${lead.category || "Unknown"}
- Business Type Classification: ${businessType}
- City: ${lead.city || "Unknown"}
- Website: ${lead.website ? "Yes" : "No"}
- Google Rating: ${lead.google_rating ?? "N/A"} (${lead.review_count ?? 0} reviews)
- Composite Score: ${lead.composite_score ?? "N/A"}
- Owner Name: ${lead.owner_name || "Unknown"}
${lead.ai_briefing ? `- AI Briefing: ${lead.ai_briefing}` : ""}

AVAILABLE CHANNELS: ${availableList.join(", ")}

RULES:
1. Design a 5-7 step cadence spread over 14-21 days
2. Only use channels from the AVAILABLE CHANNELS list above
3. Each channel value MUST be exactly one of: ${availableList.join(", ")}
4. day_offset starts at 0 (today) and increases. Space steps appropriately.
5. template_name should be descriptive (e.g., "cold_call", "follow_up_email", "social_dm_intro", "social_dm_follow_up", "breakup_email", "final_call", "walk_in")
6. Consider the business type when choosing channel order and timing:
   - Restaurants/retail: in-person and phone work best, social DMs for engagement
   - Professional services: email first, then phone follow-ups
   - Home services: phone is primary, email for proposals
   - Creators: social DMs first, then email
7. Front-load the strongest channel for this business type
8. End with a personal touch (phone or in-person if available)
9. Mix channels to avoid being repetitive on one method

Return ONLY a JSON array of steps. No markdown, no explanation, just the array:
[{"step_number": 1, "channel": "phone", "day_offset": 0, "template_name": "cold_call", "reasoning": "brief reason"}]`;

    // ── Call Claude ───────────────────────────────────────────
    const anthropic = await getAnthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 500 }
      );
    }

    // ── Parse AI response ────────────────────────────────────
    let aiSteps: AICadenceStep[];
    try {
      // Strip any markdown code fencing if present
      let raw = textBlock.text.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      aiSteps = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI cadence response", raw: textBlock.text },
        { status: 500 }
      );
    }

    if (!Array.isArray(aiSteps) || aiSteps.length === 0) {
      return NextResponse.json(
        { error: "AI returned empty or invalid cadence" },
        { status: 500 }
      );
    }

    // ── Compute scheduled_at dates with smart timing ─────────
    const now = new Date();
    const cadenceRows = aiSteps.map((step) => {
      // Validate channel
      const channel = VALID_CHANNELS.includes(step.channel as (typeof VALID_CHANNELS)[number])
        ? step.channel
        : "other";

      // Calculate base date from day_offset
      const scheduledDate = new Date(now);
      scheduledDate.setDate(scheduledDate.getDate() + (step.day_offset || 0));

      // Apply smart timing based on channel
      if (channel === "phone") {
        const bestWindow = getNextBestWindow(businessType, scheduledDate);
        scheduledDate.setTime(bestWindow.date.getTime());
      } else if (channel === "email") {
        // Emails: business morning for inbox visibility
        adjustToBusinessHour(scheduledDate, 8);
      } else if (channel === "in_person") {
        // Walk-ins: mid-morning
        adjustToBusinessHour(scheduledDate, 10);
      } else {
        // Social DMs: engagement hours
        adjustToBusinessHour(scheduledDate, 12);
      }

      return {
        lead_id: leadId,
        user_id: userId,
        step_number: step.step_number,
        channel,
        scheduled_at: scheduledDate.toISOString(),
        template_name: step.template_name || "general_outreach",
        completed_at: null,
        skipped: false,
      };
    });

    // ── Insert into Supabase ─────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from("cadences")
      .insert(cadenceRows)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save cadence", detail: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      steps: inserted,
      reasoning: aiSteps.map((s) => ({
        step: s.step_number,
        channel: s.channel,
        reasoning: s.reasoning,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate AI cadence", detail: message },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Skip weekends and set hour */
function adjustToBusinessHour(date: Date, hour: number) {
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hour, 0, 0, 0);
}
