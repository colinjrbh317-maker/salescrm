// Smart call timing engine
// Static rules per business type + outcome-based learning

import type { Activity, Lead } from "./types";

// ============================================================
// Business type classification
// ============================================================

export type BusinessType =
  | "restaurant"
  | "retail"
  | "professional_services"
  | "health_wellness"
  | "home_services"
  | "automotive"
  | "creator"
  | "general";

const CATEGORY_KEYWORDS: Record<BusinessType, string[]> = {
  restaurant: [
    "restaurant", "cafe", "coffee", "bakery", "bar", "grill", "pizza",
    "sushi", "thai", "chinese", "mexican", "italian", "indian", "food",
    "diner", "bistro", "eatery", "kitchen", "brewing", "brewery", "pub",
    "taco", "burger", "nepalese", "japanese", "korean", "vietnamese",
    "catering", "deli", "juice", "smoothie", "ice cream", "bbq",
  ],
  retail: [
    "shop", "store", "boutique", "retail", "clothing", "apparel",
    "jewelry", "gift", "florist", "flower", "pet", "furniture",
    "hardware", "bookstore", "gallery", "antique", "thrift",
  ],
  professional_services: [
    "law", "legal", "attorney", "accounting", "cpa", "consulting",
    "financial", "insurance", "real estate", "realty", "architect",
    "engineering", "marketing", "agency", "design", "photography",
    "photographer", "videograph", "studio", "media", "creative",
    "tech", "software", "it services", "staffing", "recruiting",
  ],
  health_wellness: [
    "dental", "dentist", "doctor", "medical", "clinic", "therapy",
    "therapist", "chiropract", "massage", "spa", "salon", "barber",
    "beauty", "nail", "yoga", "fitness", "gym", "wellness", "health",
    "veterinar", "vet", "optom", "eye", "pharmacy", "urgent care",
  ],
  home_services: [
    "plumb", "electric", "hvac", "roofing", "roofer", "landscap",
    "painting", "painter", "cleaning", "janitorial", "pest",
    "contractor", "construction", "remodel", "handyman", "moving",
    "locksmith", "garage door", "fencing", "pool", "solar",
  ],
  automotive: [
    "auto", "car", "mechanic", "tire", "body shop", "collision",
    "detailing", "wash", "dealer", "towing", "transmission",
  ],
  creator: [
    "creator", "influencer", "blogger", "youtuber", "podcast",
    "streamer", "content creator", "social media",
  ],
  general: [],
};

/**
 * Classify a lead's free-form category into a business type bucket.
 * Uses keyword matching with fallback to "general".
 */
export function classifyBusinessType(category: string | null): BusinessType {
  if (!category) return "general";
  const lower = category.toLowerCase();

  for (const [type, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (type === "general") continue;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return type as BusinessType;
    }
  }

  return "general";
}

// ============================================================
// Optimal call windows (static rules)
// ============================================================

export interface CallWindow {
  /** 0=Sunday, 1=Monday, ..., 6=Saturday */
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  /** 0-1 weight — higher means better window */
  weight: number;
  label: string;
}

/**
 * Static optimal calling windows per business type.
 * Based on industry research:
 * - Best days: Tue-Thu generally
 * - Best times vary by business type
 * - Restaurants: before service (2-4pm), early morning (9-10:30am)
 * - Professional services: 10am-12pm, 2-4pm
 * - Retail: early morning before customers (9-10:30am), early afternoon
 * - Home services: early morning before jobs (7-8:30am), late afternoon
 */
export const CALL_WINDOWS: Record<BusinessType, CallWindow[]> = {
  restaurant: [
    // Tue-Thu 9-10:30am (before lunch prep)
    { dayOfWeek: 2, startHour: 9, endHour: 10.5, weight: 0.9, label: "Before lunch prep" },
    { dayOfWeek: 3, startHour: 9, endHour: 10.5, weight: 0.95, label: "Before lunch prep" },
    { dayOfWeek: 4, startHour: 9, endHour: 10.5, weight: 0.9, label: "Before lunch prep" },
    // Mon-Thu 2-4pm (between services)
    { dayOfWeek: 1, startHour: 14, endHour: 16, weight: 0.8, label: "Between services" },
    { dayOfWeek: 2, startHour: 14, endHour: 16, weight: 0.85, label: "Between services" },
    { dayOfWeek: 3, startHour: 14, endHour: 16, weight: 0.9, label: "Between services" },
    { dayOfWeek: 4, startHour: 14, endHour: 16, weight: 0.85, label: "Between services" },
  ],
  retail: [
    // Tue-Thu 9-10:30am (before store opens/gets busy)
    { dayOfWeek: 2, startHour: 9, endHour: 10.5, weight: 0.9, label: "Before store opens" },
    { dayOfWeek: 3, startHour: 9, endHour: 10.5, weight: 0.95, label: "Before store opens" },
    { dayOfWeek: 4, startHour: 9, endHour: 10.5, weight: 0.9, label: "Before store opens" },
    // Mon-Thu 1-3pm (after lunch lull)
    { dayOfWeek: 1, startHour: 13, endHour: 15, weight: 0.75, label: "Afternoon lull" },
    { dayOfWeek: 2, startHour: 13, endHour: 15, weight: 0.8, label: "Afternoon lull" },
    { dayOfWeek: 3, startHour: 13, endHour: 15, weight: 0.85, label: "Afternoon lull" },
    { dayOfWeek: 4, startHour: 13, endHour: 15, weight: 0.8, label: "Afternoon lull" },
  ],
  professional_services: [
    // Tue-Thu 10am-12pm (settled into day)
    { dayOfWeek: 2, startHour: 10, endHour: 12, weight: 0.9, label: "Mid-morning" },
    { dayOfWeek: 3, startHour: 10, endHour: 12, weight: 0.95, label: "Mid-morning" },
    { dayOfWeek: 4, startHour: 10, endHour: 12, weight: 0.9, label: "Mid-morning" },
    // Mon-Thu 2-4pm (post-lunch energy)
    { dayOfWeek: 1, startHour: 14, endHour: 16, weight: 0.8, label: "Post-lunch" },
    { dayOfWeek: 2, startHour: 14, endHour: 16, weight: 0.85, label: "Post-lunch" },
    { dayOfWeek: 3, startHour: 14, endHour: 16, weight: 0.9, label: "Post-lunch" },
    { dayOfWeek: 4, startHour: 14, endHour: 16, weight: 0.85, label: "Post-lunch" },
    // Friday morning (wrapping up week, receptive)
    { dayOfWeek: 5, startHour: 10, endHour: 12, weight: 0.7, label: "Friday morning" },
  ],
  health_wellness: [
    // Tue-Thu 8-9:30am (before first appointments)
    { dayOfWeek: 2, startHour: 8, endHour: 9.5, weight: 0.9, label: "Before appointments" },
    { dayOfWeek: 3, startHour: 8, endHour: 9.5, weight: 0.95, label: "Before appointments" },
    { dayOfWeek: 4, startHour: 8, endHour: 9.5, weight: 0.9, label: "Before appointments" },
    // Mon-Thu 12-1:30pm (lunch break)
    { dayOfWeek: 1, startHour: 12, endHour: 13.5, weight: 0.75, label: "Lunch break" },
    { dayOfWeek: 2, startHour: 12, endHour: 13.5, weight: 0.8, label: "Lunch break" },
    { dayOfWeek: 3, startHour: 12, endHour: 13.5, weight: 0.85, label: "Lunch break" },
    { dayOfWeek: 4, startHour: 12, endHour: 13.5, weight: 0.8, label: "Lunch break" },
  ],
  home_services: [
    // Mon-Fri 7-8:30am (before heading to jobs)
    { dayOfWeek: 1, startHour: 7, endHour: 8.5, weight: 0.85, label: "Before jobs" },
    { dayOfWeek: 2, startHour: 7, endHour: 8.5, weight: 0.9, label: "Before jobs" },
    { dayOfWeek: 3, startHour: 7, endHour: 8.5, weight: 0.9, label: "Before jobs" },
    { dayOfWeek: 4, startHour: 7, endHour: 8.5, weight: 0.9, label: "Before jobs" },
    { dayOfWeek: 5, startHour: 7, endHour: 8.5, weight: 0.85, label: "Before jobs" },
    // Mon-Thu 4:30-6pm (wrapping up day)
    { dayOfWeek: 1, startHour: 16.5, endHour: 18, weight: 0.8, label: "End of day" },
    { dayOfWeek: 2, startHour: 16.5, endHour: 18, weight: 0.85, label: "End of day" },
    { dayOfWeek: 3, startHour: 16.5, endHour: 18, weight: 0.85, label: "End of day" },
    { dayOfWeek: 4, startHour: 16.5, endHour: 18, weight: 0.8, label: "End of day" },
  ],
  automotive: [
    // Mon-Fri 8-9:30am (shop just opened)
    { dayOfWeek: 1, startHour: 8, endHour: 9.5, weight: 0.85, label: "Shop just opened" },
    { dayOfWeek: 2, startHour: 8, endHour: 9.5, weight: 0.9, label: "Shop just opened" },
    { dayOfWeek: 3, startHour: 8, endHour: 9.5, weight: 0.9, label: "Shop just opened" },
    { dayOfWeek: 4, startHour: 8, endHour: 9.5, weight: 0.9, label: "Shop just opened" },
    { dayOfWeek: 5, startHour: 8, endHour: 9.5, weight: 0.85, label: "Shop just opened" },
    // Tue-Thu 2-3:30pm (mid-afternoon)
    { dayOfWeek: 2, startHour: 14, endHour: 15.5, weight: 0.8, label: "Mid-afternoon" },
    { dayOfWeek: 3, startHour: 14, endHour: 15.5, weight: 0.85, label: "Mid-afternoon" },
    { dayOfWeek: 4, startHour: 14, endHour: 15.5, weight: 0.8, label: "Mid-afternoon" },
  ],
  creator: [
    // Tue-Thu 11am-1pm (creative mornings done)
    { dayOfWeek: 2, startHour: 11, endHour: 13, weight: 0.9, label: "Late morning" },
    { dayOfWeek: 3, startHour: 11, endHour: 13, weight: 0.95, label: "Late morning" },
    { dayOfWeek: 4, startHour: 11, endHour: 13, weight: 0.9, label: "Late morning" },
    // Mon-Thu 3-5pm (afternoon availability)
    { dayOfWeek: 1, startHour: 15, endHour: 17, weight: 0.75, label: "Afternoon" },
    { dayOfWeek: 2, startHour: 15, endHour: 17, weight: 0.8, label: "Afternoon" },
    { dayOfWeek: 3, startHour: 15, endHour: 17, weight: 0.85, label: "Afternoon" },
    { dayOfWeek: 4, startHour: 15, endHour: 17, weight: 0.8, label: "Afternoon" },
  ],
  general: [
    // Tue-Thu 10-11:30am (universal best window)
    { dayOfWeek: 2, startHour: 10, endHour: 11.5, weight: 0.85, label: "Mid-morning" },
    { dayOfWeek: 3, startHour: 10, endHour: 11.5, weight: 0.9, label: "Mid-morning" },
    { dayOfWeek: 4, startHour: 10, endHour: 11.5, weight: 0.85, label: "Mid-morning" },
    // Tue-Thu 2-3:30pm (universal second best)
    { dayOfWeek: 2, startHour: 14, endHour: 15.5, weight: 0.75, label: "Early afternoon" },
    { dayOfWeek: 3, startHour: 14, endHour: 15.5, weight: 0.8, label: "Early afternoon" },
    { dayOfWeek: 4, startHour: 14, endHour: 15.5, weight: 0.75, label: "Early afternoon" },
  ],
};

// ============================================================
// Scoring
// ============================================================

export interface TimingScore {
  score: number; // 0-1
  label: string; // "Great time" | "Good time" | "OK" | "Off-peak"
  color: "emerald" | "blue" | "amber" | "slate";
  matchingWindow: CallWindow | null;
  businessType: BusinessType;
}

/**
 * Score how good the current moment is to call a specific lead.
 * Returns 0-1 score with contextual label.
 */
export function scoreCurrentMoment(
  lead: Pick<Lead, "category">,
  now: Date = new Date()
): TimingScore {
  const businessType = classifyBusinessType(lead.category);
  const windows = CALL_WINDOWS[businessType];

  const dayOfWeek = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;

  let bestScore = 0;
  let bestWindow: CallWindow | null = null;

  for (const w of windows) {
    if (w.dayOfWeek !== dayOfWeek) continue;
    if (hour >= w.startHour && hour <= w.endHour) {
      // Inside the window — full weight
      if (w.weight > bestScore) {
        bestScore = w.weight;
        bestWindow = w;
      }
    } else {
      // Near-window bonus: within 1 hour of a window
      const distStart = Math.abs(hour - w.startHour);
      const distEnd = Math.abs(hour - w.endHour);
      const dist = Math.min(distStart, distEnd);
      if (dist <= 1) {
        const nearScore = w.weight * (1 - dist) * 0.5;
        if (nearScore > bestScore) {
          bestScore = nearScore;
          bestWindow = w;
        }
      }
    }
  }

  // Weekday bonus for any business day (Mon-Fri) even outside windows
  if (bestScore === 0 && dayOfWeek >= 1 && dayOfWeek <= 5) {
    if (hour >= 8 && hour <= 17) {
      bestScore = 0.2; // Business hours floor
    }
  }

  return {
    score: Math.round(bestScore * 100) / 100,
    label: bestScore >= 0.7 ? "Great time" : bestScore >= 0.4 ? "Good time" : bestScore >= 0.2 ? "OK" : "Off-peak",
    color: bestScore >= 0.7 ? "emerald" : bestScore >= 0.4 ? "blue" : bestScore >= 0.2 ? "amber" : "slate",
    matchingWindow: bestWindow,
    businessType,
  };
}

// ============================================================
// Outcome-based learning
// ============================================================

interface OutcomeSlot {
  dayOfWeek: number;
  hour: number; // rounded to nearest hour
  totalCalls: number;
  connects: number;
  connectRate: number;
}

/**
 * Analyze historical call activities to find patterns in connect rates
 * by day-of-week and hour. Returns adjustments to static windows.
 */
export function analyzeOutcomePatterns(
  activities: Pick<Activity, "activity_type" | "outcome" | "occurred_at">[]
): OutcomeSlot[] {
  // Filter to call activities only
  const calls = activities.filter(
    (a) => a.activity_type === "cold_call" || a.activity_type === "follow_up_call"
  );

  if (calls.length < 5) return []; // Need minimum data

  // Group by day+hour
  const slotMap = new Map<string, { total: number; connects: number }>();

  for (const call of calls) {
    const d = new Date(call.occurred_at);
    const key = `${d.getDay()}-${d.getHours()}`;
    const slot = slotMap.get(key) ?? { total: 0, connects: 0 };
    slot.total++;
    if (call.outcome === "connected" || call.outcome === "interested" || call.outcome === "meeting_set") {
      slot.connects++;
    }
    slotMap.set(key, slot);
  }

  const slots: OutcomeSlot[] = [];
  for (const [key, data] of slotMap) {
    const [day, hour] = key.split("-").map(Number);
    if (data.total >= 3) { // Need at least 3 calls in a slot for meaningful data
      slots.push({
        dayOfWeek: day,
        hour,
        totalCalls: data.total,
        connects: data.connects,
        connectRate: data.connects / data.total,
      });
    }
  }

  return slots.sort((a, b) => b.connectRate - a.connectRate);
}

/**
 * Get the best upcoming call window for a lead's business type.
 * Useful for scheduling cadence steps.
 */
export function getNextBestWindow(
  businessType: BusinessType,
  fromDate: Date = new Date()
): { date: Date; window: CallWindow } {
  const windows = CALL_WINDOWS[businessType];

  // Look up to 7 days ahead
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(fromDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dayOfWeek = checkDate.getDay();

    // Find best window for this day
    const dayWindows = windows
      .filter((w) => w.dayOfWeek === dayOfWeek)
      .sort((a, b) => b.weight - a.weight);

    for (const w of dayWindows) {
      const windowDate = new Date(checkDate);
      windowDate.setHours(Math.floor(w.startHour), (w.startHour % 1) * 60, 0, 0);

      // Only if the window hasn't passed yet
      if (dayOffset === 0 && windowDate <= fromDate) continue;

      return { date: windowDate, window: w };
    }
  }

  // Fallback: next business day at 10am
  const fallback = new Date(fromDate);
  fallback.setDate(fallback.getDate() + 1);
  while (fallback.getDay() === 0 || fallback.getDay() === 6) {
    fallback.setDate(fallback.getDate() + 1);
  }
  fallback.setHours(10, 0, 0, 0);

  return {
    date: fallback,
    window: { dayOfWeek: fallback.getDay(), startHour: 10, endHour: 12, weight: 0.5, label: "General business hours" },
  };
}

/**
 * Get all optimal windows for a business type as a readable summary.
 * Useful for display on lead detail page.
 */
export function getWindowSummary(businessType: BusinessType): {
  dayLabel: string;
  timeRange: string;
  quality: "best" | "good";
}[] {
  const windows = CALL_WINDOWS[businessType];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Group windows by time range
  const groups = new Map<string, { days: number[]; weight: number; label: string }>();

  for (const w of windows) {
    const startH = Math.floor(w.startHour);
    const startM = (w.startHour % 1) * 60;
    const endH = Math.floor(w.endHour);
    const endM = (w.endHour % 1) * 60;
    const timeKey = `${startH}:${String(startM).padStart(2, "0")}-${endH}:${String(endM).padStart(2, "0")}`;

    const group = groups.get(timeKey) ?? { days: [], weight: 0, label: w.label };
    group.days.push(w.dayOfWeek);
    group.weight = Math.max(group.weight, w.weight);
    groups.set(timeKey, group);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([timeRange, group]) => {
      const sortedDays = [...group.days].sort();
      const dayLabel =
        sortedDays.length >= 3 &&
        sortedDays[sortedDays.length - 1] - sortedDays[0] === sortedDays.length - 1
          ? `${dayNames[sortedDays[0]]}-${dayNames[sortedDays[sortedDays.length - 1]]}`
          : sortedDays.map((d) => dayNames[d]).join(", ");

      // Format time range nicely
      const [start, end] = timeRange.split("-");
      const formatTime = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        const ampm = h >= 12 ? "pm" : "am";
        const h12 = h > 12 ? h - 12 : h;
        return m > 0 ? `${h12}:${String(m).padStart(2, "0")}${ampm}` : `${h12}${ampm}`;
      };

      return {
        dayLabel,
        timeRange: `${formatTime(start)} - ${formatTime(end)}`,
        quality: group.weight >= 0.85 ? "best" as const : "good" as const,
      };
    });
}
