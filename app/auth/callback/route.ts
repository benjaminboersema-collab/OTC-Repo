import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles BOTH magic-link styles so sign-in works regardless of the Supabase
// email-template configuration:
//   • PKCE code flow      -> ?code=...
//   • token-hash OTP flow -> ?token_hash=...&type=magiclink
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const site = process.env.NEXT_PUBLIC_SITE_URL || origin;

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${site}${next}`);
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(`${site}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
