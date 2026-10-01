"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

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
    const payment =
      searchParams.get("payment");

    const sessionId =
      searchParams.get("session_id");

    if (
      payment === "success" &&
      sessionId
    ) {
      verifyCheckoutSession(
        sessionId
      );

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
    subscriptionStatus ===
      "canceling" &&
    isPaidPeriodActive;

  const isActivePro =
    plan === "pro" &&
    subscriptionStatus ===
      "active" &&
    isPaidPeriodActive;

  const isExpiredPro =
    plan === "pro" &&
    periodEndTimestamp !== null &&
    periodEndTimestamp <=
      Date.now();

  const daysRemaining =
    subscriptionPeriodEnd
      ? Math.max(
          0,
          Math.ceil(
            (
              new Date(
                subscriptionPeriodEnd
              ).getTime() -
              Date.now()
            ) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  const formattedEndDate =
    subscriptionPeriodEnd
      ? new Date(
          subscriptionPeriodEnd
        ).toLocaleDateString()
      : null;

  const paymentSuccess =
    searchParams.get("payment") ===
    "success";

  const paymentCanceled =
    searchParams.get("payment") ===
    "canceled";

  // -------------------------------------------------------
  // START PRO CHECKOUT
  // -------------------------------------------------------

  async function startProCheckout() {
    if (changingPlan !== null) {
      return;
    }

    /*
     * IMPORTANT:
     * Reactivate before setting changingPlan.
     * reactivateSubscription() has its own
     * changingPlan guard.
     */
    if (isCanceling) {
      await reactivateSubscription();
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

      /*
       * Backend detected an already-active
       * subscription.
       */
      if (data.already_active) {
        setPlan("pro");

        setSubscriptionStatus(
          "active"
        );

        setSubscriptionPeriodEnd(
          data.subscription_period_end ||
            null
        );

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

      /*
       * Subscription has already expired.
       * User must create a new checkout.
       */
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

      /*
       * Still inside paid period.
       * Reactivation does NOT create a new payment.
       */
      setPlan("pro");

      setSubscriptionStatus(
        "active"
      );

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

  // -------------------------------------------------------
  // LOADING
  // -------------------------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="h-32 rounded-2xl bg-slate-100" />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-80 rounded-2xl bg-slate-100" />
              <div className="h-80 rounded-2xl bg-slate-100" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------
  // PAGE
  // -------------------------------------------------------

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/settings"
            className="mb-5 inline-flex items-center text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Back to Settings
          </Link>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Plan & Billing
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage your DocChatAI subscription and
            billing.
          </p>
        </div>

        {/* Success / Error Messages */}
        {paymentSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Payment completed. Your Pro subscription
            is being activated.
          </div>
        )}

        {paymentCanceled && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Checkout was canceled. No subscription
            changes were made.
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Current Plan */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Current Plan
              </p>

              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-slate-950">
                  {plan === "pro"
                    ? "Pro"
                    : "Free"}
                </h2>

                {isActivePro && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                )}

                {isCanceling && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    Canceling
                  </span>
                )}

                {plan === "free" && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Current
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-slate-500">
                {plan === "pro"
                  ? plans.pro.description
                  : plans.free.description}
              </p>
            </div>

            <div className="text-left md:text-right">
              <div className="text-2xl font-semibold text-slate-950">
                {plan === "pro"
                  ? "$19.99"
                  : "$0"}
              </div>

              <div className="text-sm text-slate-500">
                per month
              </div>
            </div>
          </div>

          {plan === "pro" &&
            subscriptionPeriodEnd && (
              <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {isCanceling
                      ? "Access Until"
                      : "Current Billing Period"}
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formattedEndDate}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Days Remaining
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {daysRemaining !== null
                      ? daysRemaining
                      : "—"}
                  </p>
                </div>
              </div>
            )}

          {/* Active Pro Actions */}
          {isActivePro && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={() =>
                  setShowCancelModal(true)
                }
                disabled={
                  changingPlan !== null ||
                  paymentProcessing
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {changingPlan === "free"
                  ? "Canceling..."
                  : "Cancel Pro"}
              </button>
            </div>
          )}

          {/* Scheduled Cancellation */}
          {isCanceling && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Your Pro subscription is scheduled
                to cancel.
              </p>

              <p className="mt-1 text-sm text-amber-700">
                You will continue to have Pro access
                until{" "}
                <strong>
                  {formattedEndDate}
                </strong>
                .
              </p>

              <button
                type="button"
                onClick={reactivateSubscription}
                disabled={
                  changingPlan !== null ||
                  paymentProcessing
                }
                className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {changingPlan === "pro"
                  ? "Reactivating..."
                  : "Keep Pro"}
              </button>
            </div>
          )}
        </section>

        {/* Plans */}
        <section>
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-950">
              Available Plans
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Choose the plan that fits your document
              workflow.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">

            {/* Free */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-950">
                    Free
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {plans.free.description}
                  </p>
                </div>

                {plan === "free" && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Current
                  </span>
                )}
              </div>

              <div className="mt-6">
                <span className="text-3xl font-semibold text-slate-950">
                  $0
                </span>

                <span className="ml-1 text-sm text-slate-500">
                  / month
                </span>
              </div>

              <ul className="mt-6 space-y-3">
                {plans.free.features.map(
                  (feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-3 text-sm text-slate-600"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                        ✓
                      </span>

                      {feature}
                    </li>
                  )
                )}
              </ul>

              <button
                type="button"
                disabled
                className="mt-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-400"
              >
                {plan === "free"
                  ? "Current Plan"
                  : "Free Plan"}
              </button>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border border-slate-900 bg-white p-6 shadow-sm">
              <div className="absolute right-5 top-5 rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                Pro
              </div>

              <div className="pr-16">
                <h3 className="text-xl font-semibold text-slate-950">
                  Pro
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {plans.pro.description}
                </p>
              </div>

              <div className="mt-6">
                <span className="text-3xl font-semibold text-slate-950">
                  $19.99
                </span>

                <span className="ml-1 text-sm text-slate-500">
                  / month
                </span>
              </div>

              <ul className="mt-6 space-y-3">
                {plans.pro.features.map(
                  (feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-3 text-sm text-slate-700"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-700">
                        ✓
                      </span>

                      {feature}
                    </li>
                  )
                )}
              </ul>

              <button
                type="button"
                onClick={
                  openUpgradeConfirmation
                }
                disabled={
                  changingPlan !== null ||
                  paymentProcessing ||
                  isActivePro
                }
                className="mt-8 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {changingPlan === "pro"
                  ? "Processing..."
                  : isActivePro
                    ? "Current Plan"
                    : isCanceling
                      ? "Keep Pro"
                      : isExpiredPro
                        ? "Restart Pro"
                        : "Upgrade to Pro"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

            <h2 className="text-xl font-semibold text-slate-950">
              Upgrade to Pro?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              You will be redirected to Stripe Checkout
              to subscribe to DocChatAI Pro for
              <strong className="font-semibold text-slate-900">
                {" "}
                $19.99/month
              </strong>
              .
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                Pro includes:
              </p>

              <ul className="mt-3 space-y-2">
                {plans.pro.features.map(
                  (feature) => (
                    <li
                      key={feature}
                      className="flex gap-2 text-sm text-slate-600"
                    >
                      <span>✓</span>
                      <span>{feature}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={
                  closeUpgradeConfirmation
                }
                disabled={paymentProcessing}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Go Back
              </button>

              <button
                type="button"
                onClick={confirmUpgrade}
                disabled={paymentProcessing}
                className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {paymentProcessing
                  ? "Processing..."
                  : "Continue to Checkout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

            <h2 className="text-xl font-semibold text-slate-950">
              Cancel Pro?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your subscription will be canceled at
              the end of your current paid billing
              period.
            </p>

            {formattedEndDate && (
              <div className="mt-4 rounded-xl bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
                  You will keep Pro access until{" "}
                  <strong>
                    {formattedEndDate}
                  </strong>
                  .
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowCancelModal(false)
                }
                disabled={
                  changingPlan !== null
                }
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Keep Pro
              </button>

              <button
                type="button"
                onClick={
                  cancelSubscription
                }
                disabled={
                  changingPlan !== null
                }
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {changingPlan === "free"
                  ? "Canceling..."
                  : "Cancel Pro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}