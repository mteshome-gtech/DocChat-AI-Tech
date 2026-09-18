import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Request
from supabase import create_client, Client


router = APIRouter(
    prefix="/billing",
    tags=["billing"],
)


# =========================================================
# ENVIRONMENT VARIABLES
# =========================================================

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID")

FRONTEND_URL = os.getenv("FRONTEND_URL")

if not FRONTEND_URL:
    raise RuntimeError("FRONTEND_URL is not configured.")

FRONTEND_URL = FRONTEND_URL.rstrip("/")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# =========================================================
# SUPABASE
# =========================================================

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Supabase environment variables are missing."
        )

    return create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
    )


# =========================================================
# STRIPE HELPERS
# =========================================================

def get_stripe_metadata_value(
    stripe_object,
    key,
    default=None,
):
    metadata = getattr(
        stripe_object,
        "metadata",
        None,
    )

    if not metadata:
        return default

    try:
        return getattr(
            metadata,
            key,
            default,
        )
    except Exception:
        return default


def get_period_end_timestamp(subscription):
    period_end = getattr(
        subscription,
        "current_period_end",
        None,
    )

    if period_end:
        return period_end

    items = getattr(
        subscription,
        "items",
        None,
    )

    data = getattr(
        items,
        "data",
        None,
    )

    if data:
        for item in data:
            item_period_end = getattr(
                item,
                "current_period_end",
                None,
            )

            if item_period_end:
                return item_period_end

    return None


def get_period_end_iso(subscription):
    period_end = get_period_end_timestamp(
        subscription
    )

    if not period_end:
        return None

    return datetime.fromtimestamp(
        period_end,
        tz=timezone.utc,
    ).isoformat()


def get_subscription_is_canceling(subscription):
    return bool(
        getattr(
            subscription,
            "cancel_at_period_end",
            False,
        )
    )


def get_subscription_status(subscription):
    return getattr(
        subscription,
        "status",
        None,
    )


def get_subscription_plan_status(subscription):
    status = get_subscription_status(
        subscription
    )

    cancel_at_period_end = (
        get_subscription_is_canceling(
            subscription
        )
    )

    if status in {"active", "trialing"}:
        if cancel_at_period_end:
            return "canceling"

        if status == "trialing":
            return "trialing"

        return "active"

    if status == "past_due":
        return "past_due"

    if status == "canceled":
        return "canceled"

    return "inactive"


def find_profile_by_subscription(
    supabase: Client,
    subscription,
):
    user_id = get_stripe_metadata_value(
        subscription,
        "supabase_user_id",
    )

    if user_id:
        response = (
            supabase
            .table("profiles")
            .select("id")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )

        if response.data:
            return response.data

    customer_id = getattr(
        subscription,
        "customer",
        None,
    )

    if customer_id:
        response = (
            supabase
            .table("profiles")
            .select("id")
            .eq(
                "stripe_customer_id",
                customer_id,
            )
            .maybe_single()
            .execute()
        )

        if response.data:
            return response.data

    return None


# =========================================================
# CREATE CHECKOUT SESSION
# =========================================================

@router.post("/create-checkout-session")
async def create_checkout_session(
    request: Request,
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="Stripe secret key is not configured.",
        )

    if not STRIPE_PRO_PRICE_ID:
        raise HTTPException(
            status_code=500,
            detail="Stripe Pro price ID is not configured.",
        )

    body = await request.json()

    user_id = body.get("user_id")
    email = body.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=400,
            detail="user_id and email are required.",
        )

    supabase = get_supabase()

    profile_response = (
        supabase
        .table("profiles")
        .select(
            "id, email, plan, subscription_status, "
            "stripe_customer_id, stripe_subscription_id, "
            "subscription_period_end"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )

    profile = profile_response.data

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="User profile not found.",
        )

    subscription_id = profile.get(
        "stripe_subscription_id"
    )

    # =====================================================
    # CHECK EXISTING STRIPE SUBSCRIPTION
    # =====================================================

    if subscription_id:
        try:
            subscription = (
                stripe.Subscription.retrieve(
                    subscription_id
                )
            )

            stripe_status = get_subscription_status(
                subscription
            )

            period_end_timestamp = (
                get_period_end_timestamp(
                    subscription
                )
            )

            period_end_iso = get_period_end_iso(
                subscription
            )

            now_timestamp = datetime.now(
                timezone.utc
            ).timestamp()

            paid_period_active = (
                period_end_timestamp is not None
                and period_end_timestamp > now_timestamp
            )

            # -------------------------------------------------
            # ACTIVE OR TRIALING SUBSCRIPTION
            # -------------------------------------------------

            if stripe_status in {
                "active",
                "trialing",
            } and paid_period_active:

                canceling = (
                    get_subscription_is_canceling(
                        subscription
                    )
                )

                # Do not create another Checkout session.
                # If cancellation is scheduled, remove it.
                if canceling:
                    subscription = (
                        stripe.Subscription.modify(
                            subscription_id,
                            cancel_at_period_end=False,
                        )
                    )

                    period_end_iso = (
                        get_period_end_iso(
                            subscription
                        )
                    )

                subscription_status = (
                    "trialing"
                    if stripe_status == "trialing"
                    else "active"
                )

                (
                    supabase
                    .table("profiles")
                    .update(
                        {
                            "plan": "pro",
                            "subscription_status":
                                subscription_status,
                            "stripe_subscription_id":
                                subscription_id,
                            "subscription_period_end":
                                period_end_iso,
                        }
                    )
                    .eq("id", user_id)
                    .execute()
                )

                return {
                    "already_active": True,
                    "message": (
                        "Your Pro subscription is already active."
                    ),
                    "subscription_period_end":
                        period_end_iso,
                }

        except stripe.error.StripeError:
            pass

    # =====================================================
    # CREATE / REUSE STRIPE CUSTOMER
    # =====================================================

    customer_id = profile.get(
        "stripe_customer_id"
    )

    if not customer_id:
        customer = stripe.Customer.create(
            email=email,
            metadata={
                "supabase_user_id": user_id,
            },
        )

        customer_id = customer.id

        (
            supabase
            .table("profiles")
            .update(
                {
                    "stripe_customer_id":
                        customer_id,
                }
            )
            .eq("id", user_id)
            .execute()
        )

    # =====================================================
    # CREATE NEW STRIPE CHECKOUT
    # =====================================================

    checkout_session = (
        stripe.checkout.Session.create(
            mode="subscription",
            managed_payments={
                "enabled": False,
            },
            customer=customer_id,
            line_items=[
                {
                    "price": STRIPE_PRO_PRICE_ID,
                    "quantity": 1,
                }
            ],
            success_url=(
                f"{FRONTEND_URL}/settings/billing"
                "?payment=success"
                "&session_id={CHECKOUT_SESSION_ID}"
            ),
            cancel_url=(
                f"{FRONTEND_URL}/settings/billing"
                "?payment=canceled"
            ),
            metadata={
                "supabase_user_id": user_id,
            },
            subscription_data={
                "metadata": {
                    "supabase_user_id": user_id,
                }
            },
        )
    )

    return {
        "checkout_url":
            checkout_session.url,
        "session_id":
            checkout_session.id,
    }


# =========================================================
# CANCEL SUBSCRIPTION
# =========================================================

@router.post("/cancel")
async def cancel_subscription(
    request: Request,
):
    body = await request.json()

    user_id = body.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="user_id is required.",
        )

    supabase = get_supabase()

    profile_response = (
        supabase
        .table("profiles")
        .select(
            "id, plan, subscription_status, "
            "stripe_customer_id, stripe_subscription_id, "
            "subscription_period_end"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )

    profile = profile_response.data

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="User profile not found.",
        )

    subscription_id = profile.get(
        "stripe_subscription_id"
    )

    if not subscription_id:
        raise HTTPException(
            status_code=400,
            detail="No active Stripe subscription found.",
        )

    try:
        subscription = (
            stripe.Subscription.retrieve(
                subscription_id
            )
        )

        status = get_subscription_status(
            subscription
        )

        if status not in {
            "active",
            "trialing",
        }:
            raise HTTPException(
                status_code=400,
                detail="The Stripe subscription is not active.",
            )

        subscription = (
            stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True,
            )
        )

    except HTTPException:
        raise

    except stripe.error.StripeError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    period_end_iso = get_period_end_iso(
        subscription
    )

    if not period_end_iso:
        raise HTTPException(
            status_code=500,
            detail=(
                "Stripe did not return a subscription "
                "billing period end."
            ),
        )

    (
        supabase
        .table("profiles")
        .update(
            {
                "plan": "pro",
                "subscription_status":
                    "canceling",
                "stripe_subscription_id":
                    subscription_id,
                "subscription_period_end":
                    period_end_iso,
            }
        )
        .eq("id", user_id)
        .execute()
    )

    return {
        "success": True,
        "subscription_status":
            "canceling",
        "subscription_period_end":
            period_end_iso,
    }


# =========================================================
# REACTIVATE SUBSCRIPTION
# =========================================================

@router.post("/reactivate")
async def reactivate_subscription(
    request: Request,
):
    body = await request.json()

    user_id = body.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="user_id is required.",
        )

    supabase = get_supabase()

    profile_response = (
        supabase
        .table("profiles")
        .select(
            "id, plan, subscription_status, "
            "stripe_customer_id, stripe_subscription_id, "
            "subscription_period_end"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )

    profile = profile_response.data

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="User profile not found.",
        )

    subscription_id = profile.get(
        "stripe_subscription_id"
    )

    if not subscription_id:
        return {
            "success": False,
            "expired": True,
            "message": (
                "Your previous subscription has ended. "
                "A new checkout is required."
            ),
        }

    try:
        subscription = (
            stripe.Subscription.retrieve(
                subscription_id
            )
        )

        status = get_subscription_status(
            subscription
        )

        period_end_timestamp = (
            get_period_end_timestamp(
                subscription
            )
        )

        now_timestamp = datetime.now(
            timezone.utc
        ).timestamp()

        if (
            status in {
                "canceled",
                "incomplete_expired",
            }
            or not period_end_timestamp
            or period_end_timestamp <= now_timestamp
        ):
            (
                supabase
                .table("profiles")
                .update(
                    {
                        "plan": "free",
                        "subscription_status":
                            "inactive",
                        "stripe_subscription_id":
                            None,
                        "subscription_period_end":
                            None,
                    }
                )
                .eq("id", user_id)
                .execute()
            )

            return {
                "success": False,
                "expired": True,
                "message": (
                    "Your Pro period has ended. "
                    "Please start a new Pro subscription."
                ),
            }

        if status not in {
            "active",
            "trialing",
        }:
            return {
                "success": False,
                "expired": False,
                "message": (
                    "Your Stripe subscription cannot be "
                    "reactivated at this time."
                ),
            }

        # =================================================
        # REMOVE SCHEDULED CANCELLATION
        # =================================================

        subscription = (
            stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=False,
            )
        )

        period_end_iso = get_period_end_iso(
            subscription
        )

        subscription_status = (
            "trialing"
            if status == "trialing"
            else "active"
        )

        (
            supabase
            .table("profiles")
            .update(
                {
                    "plan": "pro",
                    "subscription_status":
                        subscription_status,
                    "stripe_subscription_id":
                        subscription_id,
                    "subscription_period_end":
                        period_end_iso,
                }
            )
            .eq("id", user_id)
            .execute()
        )

        return {
            "success": True,
            "expired": False,
            "subscription_status":
                subscription_status,
            "subscription_period_end":
                period_end_iso,
            "message": (
                "Your Pro subscription has been reactivated. "
                "No new payment was created."
            ),
        }

    except stripe.error.StripeError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# =========================================================
# STRIPE WEBHOOK
# =========================================================

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Stripe webhook secret is not configured.",
        )

    payload = await request.body()

    signature = request.headers.get(
        "stripe-signature"
    )

    if not signature:
        raise HTTPException(
            status_code=400,
            detail="Missing Stripe signature.",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            STRIPE_WEBHOOK_SECRET,
        )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload.",
        )

    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook signature.",
        )

    supabase = get_supabase()

    event_type = event["type"]

    print(
        f"Stripe webhook received: {event_type}"
    )

    # =====================================================
    # CHECKOUT COMPLETED
    # =====================================================

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]

        user_id = get_stripe_metadata_value(
            session,
            "supabase_user_id",
        )

        customer_id = getattr(
            session,
            "customer",
            None,
        )

        subscription_id = getattr(
            session,
            "subscription",
            None,
        )

        print(
            "Checkout completed:",
            {
                "user_id":
                    user_id,
                "customer_id":
                    customer_id,
                "subscription_id":
                    subscription_id,
            }
        )

        if not user_id:
            print(
                "WARNING: No supabase_user_id "
                "found in Checkout metadata."
            )

            return {
                "received": True,
                "activated": False,
            }

        if subscription_id:
            try:
                subscription = (
                    stripe.Subscription.retrieve(
                        subscription_id
                    )
                )

                period_end_iso = (
                    get_period_end_iso(
                        subscription
                    )
                )

                status = (
                    get_subscription_status(
                        subscription
                    )
                )

                subscription_status = (
                    get_subscription_plan_status(
                        subscription
                    )
                )

                (
                    supabase
                    .table("profiles")
                    .update(
                        {
                            "plan": "pro"
                            if status in {
                                "active",
                                "trialing",
                            }
                            else "free",
                            "subscription_status":
                                subscription_status,
                            "stripe_customer_id":
                                customer_id,
                            "stripe_subscription_id":
                                subscription_id,
                            "subscription_period_end":
                                period_end_iso,
                        }
                    )
                    .eq("id", user_id)
                    .execute()
                )

                print(
                    f"SUCCESS: Checkout synchronized "
                    f"for user {user_id}. "
                    f"period_end={period_end_iso}"
                )

            except stripe.error.StripeError as error:
                print(
                    "ERROR retrieving Stripe "
                    "subscription:",
                    str(error),
                )

    # =====================================================
    # SUBSCRIPTION CREATED / UPDATED
    # =====================================================

    elif event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
    ):
        subscription = event["data"]["object"]

        subscription_id = getattr(
            subscription,
            "id",
            None,
        )

        status = get_subscription_status(
            subscription
        )

        customer_id = getattr(
            subscription,
            "customer",
            None,
        )

        cancel_at_period_end = (
            get_subscription_is_canceling(
                subscription
            )
        )

        period_end_iso = (
            get_period_end_iso(
                subscription
            )
        )

        print(
            "Subscription event:",
            {
                "id":
                    subscription_id,
                "status":
                    status,
                "customer":
                    customer_id,
                "cancel_at_period_end":
                    cancel_at_period_end,
                "period_end":
                    period_end_iso,
            }
        )

        profile = find_profile_by_subscription(
            supabase,
            subscription,
        )

        if not profile:
            print(
                "WARNING: Could not find Supabase "
                "profile for subscription."
            )

        else:
            user_id = profile["id"]

            if status in {
                "active",
                "trialing",
            }:
                plan = "pro"

                if cancel_at_period_end:
                    subscription_status = (
                        "canceling"
                    )
                elif status == "trialing":
                    subscription_status = (
                        "trialing"
                    )
                else:
                    subscription_status = (
                        "active"
                    )

            elif status == "past_due":
                plan = "pro"
                subscription_status = (
                    "past_due"
                )

            else:
                plan = "free"
                subscription_status = (
                    "inactive"
                )

            (
                supabase
                .table("profiles")
                .update(
                    {
                        "plan": plan,
                        "subscription_status":
                            subscription_status,
                        "stripe_customer_id":
                            customer_id,
                        "stripe_subscription_id":
                            subscription_id,
                        "subscription_period_end":
                            period_end_iso,
                    }
                )
                .eq("id", user_id)
                .execute()
            )

            print(
                f"SUCCESS: Subscription synchronized "
                f"for user {user_id}. "
                f"Plan={plan}, "
                f"Status={subscription_status}, "
                f"PeriodEnd={period_end_iso}"
            )

    # =====================================================
    # SUBSCRIPTION DELETED
    # =====================================================

    elif event_type == "customer.subscription.deleted":
        subscription = event["data"]["object"]

        subscription_id = getattr(
            subscription,
            "id",
            None,
        )

        print(
            "Subscription deleted:",
            subscription_id,
        )

        profile = find_profile_by_subscription(
            supabase,
            subscription,
        )

        if profile:
            user_id = profile["id"]

            (
                supabase
                .table("profiles")
                .update(
                    {
                        "plan": "free",
                        "subscription_status":
                            "inactive",
                        "stripe_subscription_id":
                            None,
                        "subscription_period_end":
                            None,
                    }
                )
                .eq("id", user_id)
                .execute()
            )

            print(
                f"SUCCESS: User {user_id} "
                "downgraded to Free."
            )

        else:
            print(
                "WARNING: Could not find profile "
                "for deleted subscription."
            )

    # =====================================================
    # INVOICE PAID
    # =====================================================

    elif event_type == "invoice.paid":
        invoice = event["data"]["object"]

        subscription_id = getattr(
            invoice,
            "subscription",
            None,
        )

        print(
            "Invoice paid:",
            {
                "subscription_id":
                    subscription_id,
            }
        )

        if subscription_id:
            try:
                subscription = (
                    stripe.Subscription.retrieve(
                        subscription_id
                    )
                )

                profile = (
                    find_profile_by_subscription(
                        supabase,
                        subscription,
                    )
                )

                if profile:
                    user_id = profile["id"]

                    period_end_iso = (
                        get_period_end_iso(
                            subscription
                        )
                    )

                    cancel_at_period_end = (
                        get_subscription_is_canceling(
                            subscription
                        )
                    )

                    status = (
                        get_subscription_status(
                            subscription
                        )
                    )

                    if cancel_at_period_end:
                        subscription_status = (
                            "canceling"
                        )
                    elif status == "trialing":
                        subscription_status = (
                            "trialing"
                        )
                    else:
                        subscription_status = (
                            "active"
                        )

                    (
                        supabase
                        .table("profiles")
                        .update(
                            {
                                "plan": "pro",
                                "subscription_status":
                                    subscription_status,
                                "stripe_subscription_id":
                                    subscription_id,
                                "subscription_period_end":
                                    period_end_iso,
                            }
                        )
                        .eq("id", user_id)
                        .execute()
                    )

                    print(
                        f"SUCCESS: Paid invoice "
                        f"confirmed Pro for {user_id}. "
                        f"Status={subscription_status}, "
                        f"PeriodEnd={period_end_iso}"
                    )

                else:
                    print(
                        "WARNING: Invoice paid but "
                        "no matching profile found."
                    )

            except stripe.error.StripeError as error:
                print(
                    "ERROR processing paid invoice:",
                    str(error),
                )

    # =====================================================
    # INVOICE PAYMENT FAILED
    # =====================================================

    elif event_type == "invoice.payment_failed":
        invoice = event["data"]["object"]

        subscription_id = getattr(
            invoice,
            "subscription",
            None,
        )

        print(
            "Invoice payment failed:",
            {
                "subscription_id":
                    subscription_id,
            }
        )

        if subscription_id:
            try:
                subscription = (
                    stripe.Subscription.retrieve(
                        subscription_id
                    )
                )

                profile = (
                    find_profile_by_subscription(
                        supabase,
                        subscription,
                    )
                )

                if profile:
                    user_id = profile["id"]

                    status = (
                        get_subscription_status(
                            subscription
                        )
                    )

                    period_end_iso = (
                        get_period_end_iso(
                            subscription
                        )
                    )

                    if status == "past_due":
                        (
                            supabase
                            .table("profiles")
                            .update(
                                {
                                    "plan": "pro",
                                    "subscription_status":
                                        "past_due",
                                    "stripe_subscription_id":
                                        subscription_id,
                                    "subscription_period_end":
                                        period_end_iso,
                                }
                            )
                            .eq("id", user_id)
                            .execute()
                        )

                        print(
                            f"WARNING: Payment failed "
                            f"for user {user_id}. "
                            "Subscription is past_due."
                        )

            except stripe.error.StripeError as error:
                print(
                    "ERROR processing failed invoice:",
                    str(error),
                )

    return {
        "received": True,
    }