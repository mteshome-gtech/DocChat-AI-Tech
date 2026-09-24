import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const plan = requestUrl.searchParams.get("plan");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/signin?error=missing_code`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error);

    return NextResponse.redirect(
      `${origin}/auth/signin?error=auth_failed`
    );
  }

  if (type === "recovery") {
    return NextResponse.redirect(
      `${origin}/reset-password`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${origin}/auth/signin?error=session_missing`
    );
  }

  const selectedPlan =
    plan === "pro"
      ? "pro"
      : user.user_metadata?.selected_plan === "pro"
        ? "pro"
        : "free";

  if (selectedPlan === "pro") {
    if (!API_URL) {
      console.error(
        "NEXT_PUBLIC_API_URL is not configured."
      );

      return NextResponse.redirect(
        `${origin}/settings/billing?checkout_error=true`
      );
    }

    try {
      const response = await fetch(
        `${API_URL}/api/billing/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
          }),
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Failed to create Pro checkout session:",
          data
        );

        return NextResponse.redirect(
          `${origin}/settings/billing?checkout_error=true`
        );
      }

      if (data.already_active) {
        return NextResponse.redirect(
          `${origin}/settings/billing?already_active=true`
        );
      }

      if (!data.checkout_url) {
        console.error(
          "Stripe checkout URL missing:",
          data
        );

        return NextResponse.redirect(
          `${origin}/settings/billing?checkout_error=true`
        );
      }

      return NextResponse.redirect(data.checkout_url);
    } catch (error) {
      console.error(
        "Pro checkout initialization error:",
        error
      );

      return NextResponse.redirect(
        `${origin}/settings/billing?checkout_error=true`
      );
    }
  }

  return NextResponse.redirect(
    `${origin}/dashboard`
  );
}