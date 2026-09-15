"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
        console.error("Error loading plan:", error);
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

  useEffect(() => {
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
    if (changingPlan !== null) return;

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
            "Content-Type": "application/json",
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
          new Event("docchat-plan-updated")
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

    if (plan === "pro" && !isExpiredPro) {
      return;
    }

    setShowUpgradeModal(true);
  }

  function closeUpgradeConfirmation() {
    if (paymentProcessing) return;
    setShowUpgradeModal(false);
  }

  async function confirmUpgrade() {
    if (paymentProcessing) return;

    setShowUpgradeModal(false);
    await startProCheckout();
  }

  // -------------------------------------------------------
  // CANCEL SUBSCRIPTION
  // -------------------------------------------------------

  async function cancelSubscription() {
    if (changingPlan !== null) return;

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
            "Content-Type": "application/json",
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
        new Event("docchat-plan-updated")
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
  // REACTIVATE EXISTING SUBSCRIPTION
  // -------------------------------------------------------

  async function reactivateSubscription() {
    if (changingPlan !== null) return;

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
            "Content-Type": "application/json",
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
        new Event("docchat-plan-updated")
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
  // DATE HELPERS
  // -------------------------------------------------------

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

  const currentPlan =
    plans[plan];

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {paymentSuccess && (
        <div className="border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
          Payment completed. Your Pro subscription is being activated.
        </div>
      )}

      {paymentCanceled && (
        <div className="border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          Checkout was canceled. Your current plan has not changed.
        </div>
      )}

      <div>
        <Link
          href="/settings"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Settings
        </Link>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Account
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            Plan & Billing
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Manage your DocChatAI plan and subscription.
          </p>
        </div>
      </div>

      {message && (
        <div className="border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
          {message}
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Current Plan
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {loading
              ? "Loading..."
              : currentPlan.name}
          </h2>
        </div>

        <div className="grid gap-8 px-6 py-7 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">
              Subscription status
            </p>

            <p className="mt-2 text-lg font-medium capitalize text-slate-950">
              {subscriptionStatus}
            </p>

            {plan === "pro" &&
              subscriptionPeriodEnd && (
                <div className="mt-5">
                  <p className="text-sm text-slate-500">
                    Current paid period ends
                  </p>

                  <p className="mt-1 text-lg font-medium text-slate-950">
                    {formattedEndDate}
                  </p>

                  {daysRemaining !== null && (
                    <p className="mt-1 text-sm text-blue-600">
                      {daysRemaining}{" "}
                      {daysRemaining === 1
                        ? "day"
                        : "days"}{" "}
                      remaining
                    </p>
                  )}
                </div>
              )}
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Monthly price
            </p>

            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {currentPlan.price}

              {plan === "pro" && (
                <span className="ml-1 text-sm font-normal text-slate-400">
                  / month
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-7">
          <p className="text-sm font-medium text-slate-950">
            Included features
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {currentPlan.features.map(
              (feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 text-sm text-slate-600"
                >
                  <span className="text-blue-600">
                    ✓
                  </span>

                  {feature}
                </div>
              )
            )}
          </div>
        </div>

        {isActivePro && (
          <div className="border-t border-slate-200 px-6 py-6">
            <button
              type="button"
              onClick={() =>
                setShowCancelModal(true)
              }
              disabled={
                changingPlan !== null
              }
              className="border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel Pro
            </button>
          </div>
        )}

        {isCanceling && (
          <div className="border-t border-slate-200 bg-amber-50 px-6 py-6">
            <p className="text-sm font-medium text-amber-900">
              Pro cancellation scheduled
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              You will keep Pro access until{" "}
              <strong>
                {formattedEndDate ||
                  "the end of your current billing period"}
              </strong>
              . You will not be charged for another billing period.
            </p>

            <button
              type="button"
              onClick={
                reactivateSubscription
              }
              disabled={
                changingPlan !== null
              }
              className="mt-4 border border-blue-600 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {changingPlan === "pro"
                ? "Reactivating..."
                : "Keep Pro"}
            </button>
          </div>
        )}
      </section>

      <section>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Available Plans
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Choose your plan
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {(
            Object.entries(
              plans
            ) as [
              Plan,
              (typeof plans)[Plan]
            ][]
          ).map(
            ([planKey, planData]) => {
              const isCurrent =
                planKey === plan;

              const isProCard =
                planKey === "pro";

              const showResume =
                isProCard &&
                isCanceling;

              const buttonDisabled =
                changingPlan !== null ||
                (isCurrent &&
                  !showResume);

              return (
                <div
                  key={planKey}
                  className={`border bg-white p-7 ${
                    isProCard
                      ? "border-blue-500"
                      : "border-slate-200"
                  }`}
                >
                  {isProCard && (
                    <div className="mb-5 inline-block border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
                      Recommended
                    </div>
                  )}

                  <h3 className="text-2xl font-semibold text-slate-950">
                    {planData.name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {planData.description}
                  </p>

                  <div className="mt-6">
                    <span className="text-4xl font-semibold text-slate-950">
                      {planData.price}
                    </span>

                    {isProCard && (
                      <span className="ml-1 text-sm text-slate-400">
                        / month
                      </span>
                    )}
                  </div>

                  <div className="mt-7 space-y-3">
                    {planData.features.map(
                      (feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-3 text-sm text-slate-600"
                        >
                          <span className="text-blue-600">
                            ✓
                          </span>

                          {feature}
                        </div>
                      )
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={buttonDisabled}
                    onClick={() => {
                      if (
                        isProCard &&
                        isCanceling
                      ) {
                        reactivateSubscription();
                        return;
                      }

                      if (
                        isProCard &&
                        !isCurrent
                      ) {
                        openUpgradeConfirmation();
                        return;
                      }

                      if (
                        planKey === "free" &&
                        plan === "pro"
                      ) {
                        setShowCancelModal(true);
                      }
                    }}
                    className={`mt-8 w-full border px-5 py-3 text-sm font-semibold transition ${
                      showResume
                        ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                        : isCurrent
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                          : isProCard
                            ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                            : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {changingPlan ===
                    planKey
                      ? "Processing..."
                      : showResume
                        ? "Keep Pro"
                        : isCurrent
                          ? "Current Plan"
                          : isProCard
                            ? "Upgrade to Pro"
                            : "Downgrade to Free"}
                  </button>
                </div>
              );
            }
          )}
        </div>
      </section>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
          <div className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-7 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                Upgrade
              </p>

              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Upgrade to Pro?
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                You are about to upgrade your DocChatAI account to the Pro plan.
              </p>
            </div>

            <div className="px-7 py-6">
              <div className="border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-950">
                    DocChatAI Pro
                  </span>

                  <span className="text-lg font-semibold text-slate-950">
                    $19.99
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      / month
                    </span>
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {plans.pro.features.map(
                    (feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <span className="text-blue-600">
                          ✓
                        </span>

                        {feature}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm leading-6 text-amber-800">
                  You will be redirected to Stripe's secure payment page to enter and verify your payment information. Your subscription will be billed at $19.99 per month.
                </p>
              </div>

              <p className="mt-5 text-xs leading-5 text-slate-400">
                Your Pro access will be activated after Stripe confirms the subscription. If you cancel payment, your Free plan will remain active.
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-7 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  closeUpgradeConfirmation
                }
                disabled={
                  paymentProcessing
                }
                className="border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirmUpgrade
                }
                disabled={
                  paymentProcessing
                }
                className="border border-blue-600 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paymentProcessing
                  ? "Preparing payment..."
                  : "Continue to Payment →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
          <div className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-7 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
                Cancel Pro
              </p>

              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Cancel your Pro subscription?
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Your subscription will not renew at the end of your current billing period.
              </p>
            </div>

            <div className="px-7 py-6">
              <div className="border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-medium text-amber-900">
                  You will keep Pro access.
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  You will continue to have access to all Pro features until{" "}
                  <strong>
                    {formattedEndDate ||
                      "the end of your current billing period"}
                  </strong>
                  . You will not be charged for the next billing period.
                </p>
              </div>

              <p className="mt-5 text-xs leading-5 text-slate-400">
                You can change your mind and select Keep Pro before the paid period ends. Doing so will keep your existing subscription active without creating a new charge.
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-7 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  setShowCancelModal(false)
                }
                disabled={
                  changingPlan !== null
                }
                className="border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
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
                className="border border-red-600 bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {changingPlan === "free"
                  ? "Canceling..."
                  : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}