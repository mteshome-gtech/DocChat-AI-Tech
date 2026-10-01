"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Plan = "free" | "pro";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const plans = {
  free: {
    name: "Free",
    price: "$0",
    description: "Explore document intelligence.",
    features: [
      "5 documents",
      "Basic DocChat",
      "Basic analysis",
      "Standard AI",
    ],
  },

  pro: {
    name: "Pro",
    price: "$19.99",
    description:
      "Full document intelligence for serious users.",
    features: [
      "Unlimited documents",
      "Advanced DocChat",
      "Deep analysis",
      "Translation",
      "Document comparison",
      "AI Research",
      "Priority AI",
    ],
  },
} as const;

function BillingContent() {
  const supabase = createClient();

  const [plan, setPlan] = useState<Plan>("free");

  const [subscriptionStatus, setSubscriptionStatus] =
    useState("inactive");

  const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [changingPlan, setChangingPlan] =
    useState<Plan | null>(null);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [showUpgradeModal, setShowUpgradeModal] =
    useState(false);

  const [showCancelModal, setShowCancelModal] =
    useState(false);

  const [paymentProcessing, setPaymentProcessing] =
    useState(false);

  // -------------------------------------------------------
  // LOAD PLAN
  // -------------------------------------------------------

  async function loadPlan() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "plan, subscription_status, subscription_period_end"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(
          "Error loading plan:",
          error
        );

        setError(
          "Unable to load your billing information."
        );

        setLoading(false);
        return;
      }

      if (data) {
        setPlan(
          data.plan === "pro"
            ? "pro"
            : "free"
        );

        setSubscriptionStatus(
          data.subscription_status ||
            "inactive"
        );

        setSubscriptionPeriodEnd(
          data.subscription_period_end ||
            null
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load your billing information."
      );
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // VERIFY STRIPE CHECKOUT
  // -------------------------------------------------------

  async function verifyCheckoutSession(
    sessionId: string
  ) {
    try {
      setPaymentProcessing(true);
      setError("");

      setMessage(
        "Activating your Pro subscription..."
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "Please sign in again to verify your subscription."
        );

        return;
      }

      const response = await fetch(
        `${API_URL}/api/billing/verify-checkout-session`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            session_id: sessionId,
            user_id: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to verify your Pro subscription."
        );
      }

      setPlan("pro");

      setSubscriptionStatus(
        data.subscription_status ||
          "active"
      );

      setSubscriptionPeriodEnd(
        data.subscription_period_end ||
          null
      );

      setMessage(
        "Payment completed. Your Pro subscription is now active."
      );

      window.dispatchEvent(
        new Event(
          "docchat-plan-updated"
        )
      );

      window.history.replaceState(
        {},
        "",
        "/settings/billing"
      );
    } catch (err) {
      console.error(
        "Checkout verification error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify your Pro subscription."
      );
    } finally {
      setPaymentProcessing(false);
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // INITIAL PAGE LOAD
  // -------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const payment = params.get("payment");

    const sessionId = params.get(
      "session_id"
    );

    if (
      payment === "success" &&
      sessionId
    ) {
      verifyCheckoutSession(sessionId);

      return;
    }

    loadPlan();
  }, []);

  // -------------------------------------------------------
  // SUBSCRIPTION STATE
  // -------------------------------------------------------

  const periodEndTimestamp =
    subscriptionPeriodEnd
      ? new Date(
          subscriptionPeriodEnd
        ).getTime()
      : null;

  const isPaidPeriodActive =
    periodEndTimestamp !== null &&
    periodEndTimestamp > Date.now();

  const isCanceling =
    plan === "pro" &&
    subscriptionStatus === "canceling" &&
    isPaidPeriodActive;

  const isActivePro =
    plan === "pro" &&
    subscriptionStatus === "active" &&
    isPaidPeriodActive;

  const isExpiredPro =
    plan === "pro" &&
    periodEndTimestamp !== null &&
    periodEndTimestamp <= Date.now();

  // -------------------------------------------------------
  // START NEW PRO CHECKOUT
  // -------------------------------------------------------

  async function startProCheckout() {
    if (changingPlan !== null) {
      return;
    }

    setChangingPlan("pro");
    setPaymentProcessing(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "Please sign in before upgrading to Pro."
        );

        return;
      }

      if (isCanceling) {
        await reactivateSubscription();
        return;
      }

      const response = await fetch(
        `${API_URL}/api/billing/create-checkout-session`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to start Stripe Checkout."
        );
      }

      if (data.already_active) {
        setPlan("pro");

        setSubscriptionPeriodEnd(
          data.subscription_period_end ||
            null
        );

        setSubscriptionStatus("active");

        setMessage(
          "Your Pro subscription is already active."
        );

        window.dispatchEvent(
          new Event(
            "docchat-plan-updated"
          )
        );

        return;
      }

      if (!data.checkout_url) {
        throw new Error(
          "Stripe Checkout URL was not returned."
        );
      }

      window.location.href =
        data.checkout_url;
    } catch (err) {
      console.error(
        "Stripe Checkout error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start checkout."
      );
    } finally {
      setChangingPlan(null);
      setPaymentProcessing(false);
    }
  }

  // -------------------------------------------------------
  // UPGRADE CONFIRMATION
  // -------------------------------------------------------

  function openUpgradeConfirmation() {
    if (changingPlan !== null) {
      return;
    }

    setError("");
    setMessage("");

    if (isCanceling) {
      reactivateSubscription();
      return;
    }

    if (
      plan === "pro" &&
      !isExpiredPro
    ) {
      return;
    }

    setShowUpgradeModal(true);
  }

  function closeUpgradeConfirmation() {
    if (paymentProcessing) {
      return;
    }

    setShowUpgradeModal(false);
  }

  async function confirmUpgrade() {
    if (paymentProcessing) {
      return;
    }

    setShowUpgradeModal(false);

    await startProCheckout();
  }

  // -------------------------------------------------------
  // CANCEL SUBSCRIPTION
  // -------------------------------------------------------

  async function cancelSubscription() {
    if (changingPlan !== null) {
      return;
    }

    setChangingPlan("free");
    setError("");
    setMessage("");
    setShowCancelModal(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in.");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/billing/cancel`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to cancel your subscription."
        );
      }

      setPlan("pro");

      setSubscriptionStatus(
        "canceling"
      );

      setSubscriptionPeriodEnd(
        data.subscription_period_end ||
          null
      );

      const endDate =
        data.subscription_period_end
          ? new Date(
              data.subscription_period_end
            ).toLocaleDateString()
          : null;

      setMessage(
        endDate
          ? `Your Pro subscription has been canceled at the end of your current paid period. You will keep Pro access until ${endDate}.`
          : "Your Pro subscription has been canceled at the end of your current paid period. You will keep Pro access until the end of your current billing period."
      );

      window.dispatchEvent(
        new Event(
          "docchat-plan-updated"
        )
      );
    } catch (err) {
      console.error(
        "Cancellation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel your subscription."
      );
    } finally {
      setChangingPlan(null);
    }
  }

  // -------------------------------------------------------
  // REACTIVATE SUBSCRIPTION
  // -------------------------------------------------------

  async function reactivateSubscription() {
    if (changingPlan !== null) {
      return;
    }

    setChangingPlan("pro");
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in.");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/billing/reactivate`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to reactivate your subscription."
        );
      }

      if (data.expired) {
        setPlan("free");

        setSubscriptionStatus(
          "inactive"
        );

        setSubscriptionPeriodEnd(null);

        setMessage(
          "Your previous Pro subscription has ended. You can start a new Pro subscription below."
        );

        return;
      }

      setPlan("pro");

      setSubscriptionStatus("active");

      setSubscriptionPeriodEnd(
        data.subscription_period_end ||
          null
      );

      setMessage(
        "Your Pro subscription has been reactivated. No new payment was created."
      );

      window.dispatchEvent(
        new Event(
          "docchat-plan-updated"
        )
      );
    } catch (err) {
      console.error(
        "Reactivation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to reactivate your subscription."
      );
    } finally {
      setChangingPlan(null);
    }
  }

  return (
    <div>
      {/* Billing page JSX goes here */}
    </div>
  );
}

export default function BillingPage() {
  return <BillingContent />;
}