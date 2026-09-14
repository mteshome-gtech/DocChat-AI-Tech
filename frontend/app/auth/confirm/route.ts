import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/auth/signin?error=missing_confirmation`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "email",
  });

  if (error) {
    console.error("Email confirmation error:", error);

    return NextResponse.redirect(
      `${origin}/auth/signin?error=confirmation_failed`
    );
  }

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${origin}/auth/signin?error=session_missing`
    );
  }

  // Determine selected plan
  const selectedPlan =
    user.user_metadata?.selected_plan === "pro"
      ? "pro"
      : "free";

  // Pro signup automatically goes to Stripe Checkout
  if (selectedPlan === "pro") {
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
          `${origin}/billing?checkout_error=true`
        );
      }

      if (data.already_active) {
        return NextResponse.redirect(
          `${origin}/billing?already_active=true`
        );
      }

      if (!data.checkout_url) {
        console.error(
          "Stripe checkout URL missing:",
          data
        );

        return NextResponse.redirect(
          `${origin}/billing?checkout_error=true`
        );
      }

      return NextResponse.redirect(data.checkout_url);
    } catch (error) {
      console.error(
        "Pro checkout initialization error:",
        error
      );

      return NextResponse.redirect(
        `${origin}/billing?checkout_error=true`
      );
    }
  }

  // Free signup
  return NextResponse.redirect(`${origin}/dashboard`);
}