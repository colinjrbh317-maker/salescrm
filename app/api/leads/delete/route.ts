import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { leadIds } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds must be a non-empty array" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", leadIds);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: leadIds.length });
  } catch (error) {
    console.error("[Delete API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
