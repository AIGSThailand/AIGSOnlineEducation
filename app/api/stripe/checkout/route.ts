import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { getClientEnv } from "@/lib/env/client";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStripeCustomer } from "@/lib/stripe/sync";
import { createCheckoutSessionSchema } from "@/lib/validations/subscription";

/**
 * POST /api/stripe/checkout
 * Initiates a Stripe Checkout Session for one-time course/bundle purchases or subscriptions.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const body = await req.json();
    const validation = createCheckoutSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const {
      priceId: requestedPriceId,
      courseId,
      groupId,
      courseTitle,
      amount,
      currency = "usd",
      mode = "payment",
      successUrl,
      cancelUrl,
    } = validation.data;

    const { NEXT_PUBLIC_APP_URL: appUrl } = getClientEnv();

    // Prefer mapped course/group price when id is present (builder Commerce settings).
    let priceId = requestedPriceId;
    let bundleTitle: string | undefined;

    if (groupId && !priceId) {
      const { data: group } = await supabase
        .from("groups")
        .select("stripe_price_id, name, status")
        .eq("id", groupId)
        .maybeSingle<{ stripe_price_id: string | null; name: string; status: string }>();
      if (!group || group.status !== "active") {
        return NextResponse.json({ error: "Bundle not found or not active." }, { status: 404 });
      }
      if (group.stripe_price_id) {
        priceId = group.stripe_price_id;
      }
      bundleTitle = group.name;
    } else if (courseId && !priceId) {
      const { data: course } = await supabase
        .from("courses")
        .select("stripe_price_id, title")
        .eq("id", courseId)
        .maybeSingle<{ stripe_price_id: string | null; title: string }>();
      if (course?.stripe_price_id) {
        priceId = course.stripe_price_id;
      }
    }

    // 1. Retrieve or create Stripe customer linked to this Supabase user
    const { customerId } = await getOrCreateStripeCustomer(user.id, user.email!);

    // 2. Build metadata so webhook can auto-enroll and track user
    const metadata: Record<string, string> = {
      supabase_user_id: user.id,
    };
    if (courseId) metadata.course_id = courseId;
    if (groupId) metadata.group_id = groupId;

    // 3. Build line items
    let line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    if (priceId) {
      line_items = [{ price: priceId, quantity: 1 }];
    } else if (amount && (courseTitle || bundleTitle)) {
      line_items = [
        {
          price_data: {
            currency,
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: courseTitle || bundleTitle || "Course purchase",
            },
          },
          quantity: 1,
        },
      ];
    } else {
      return NextResponse.json(
        {
          error: groupId
            ? "No Stripe price is mapped for this bundle. An admin must set stripe_price_id under Groups → Commerce."
            : "No Stripe price is mapped for this course. An admin must set stripe_price_id under Course settings → Commerce.",
        },
        { status: 400 }
      );
    }

    // 4. Create Stripe Checkout Session (One-time payment by default)
    const defaultSuccessUrl = groupId
      ? `${appUrl}/bundles/${groupId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
      : courseId
        ? `${appUrl}/courses/${courseId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
        : `${appUrl}/student/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      client_reference_id: user.id,
      mode: mode,
      payment_method_types: ["card"],
      line_items,
      metadata,
      success_url: successUrl || defaultSuccessUrl,
      cancel_url:
        cancelUrl ||
        (groupId
          ? `${appUrl}/bundles/${groupId}`
          : courseId
            ? `${appUrl}/courses/${courseId}`
            : `${appUrl}/courses`),
    };

    if (mode === "subscription") {
      sessionConfig.subscription_data = { metadata };
    } else {
      sessionConfig.payment_intent_data = { metadata };
    }

    const session = await getStripe().checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("[Stripe Checkout Error]:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
