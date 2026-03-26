import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GmailMailService } from "@/adapters/gmail/GmailMailService";
import type { MailQuery } from "@/core/services/MailService";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providerToken = session.provider_token;
  if (!providerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as MailQuery;
  const mailService = new GmailMailService(providerToken);

  const ids = await mailService.list(body);
  return NextResponse.json({ ids, count: ids.length });
}
