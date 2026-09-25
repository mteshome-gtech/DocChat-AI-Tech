import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const plan = requestUrl.searchParams.get("plan");
  const next = requestUrl.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/signin?error=missing_code`
    );
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error(
      "Auth callback exchange error:",
      exchangeError.message
    );

    return NextResponse.redirect(
      `${origin}/auth/signin?error=${encodeURIComponent(
        exchangeError.message
      )}`
    );
  }

  /*
   * Password recovery flow.
   *
   * The forgot-password page sends:
   * /auth/callback?next=/auth/reset-password
   *
   * After exchanging the recovery code for a session,
   * send the user to the reset-password page.
   */
  if (
    type === "recovery" ||
    next === "/auth/reset-password"
  ) {
    return NextResponse.redirect(
      `${origin}/auth/reset-password`
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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