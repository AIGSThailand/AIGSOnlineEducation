import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getClientEnv } from "@/lib/env/client";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStripeCustomer } from "@/lib/stripe/sync";
import { createCheckoutSessionSchema } from "@/lib/validations/subscription";

/**
 * POST /api/stripe/checkout
 * Initiates a Stripe Checkout Session for one-time course purchases or subscriptions.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
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
      priceId,
      courseId,
      courseTitle,
      amount,
      currency = "usd",
      mode = "payment",
      successUrl,
      cancelUrl,
    } = validation.data;

    const { NEXT_PUBLIC_APP_URL: appUrl } = getClientEnv();

    // 1. Retrieve or create Stripe customer linked to this Supabase user
    const { customerId } = await getOrCreateStripeCustomer(
      user.id,
      user.email!
    );

    // 2. Build metadata so webhook can auto-enroll and track user
    const metadata: Record<string, string> = {
      supabase_user_id: user.id,
    };
    if (courseId) {
      metadata.course_id = courseId;
    }

    // 3. Build line items
    let line_items: any[] = [];
    if (priceId) {
      line_items = [{ price: priceId, quantity: 1 }];
    } else if (amount && courseTitle) {
      line_items = [
        {
          price_data: {
            currency,
            unit_amount: Math.round(amount * 100), // convert dollars to cents if passed as decimal
            product_data: {
              name: courseTitle,
            },
          },
          quantity: 1,
        },
      ];
    } else {
      return NextResponse.json(
        { error: "Either a Stripe priceId or courseTitle + amount is required." },
        { status: 400 }
      );
    }

    // 4. Create Stripe Checkout Session (One-time payment by default)
    const sessionConfig: any = {
      customer: customerId,
      mode: mode, // "payment" for one-time
      payment_method_types: ["card"],
      line_items,
      metadata,
      success_url:
        successUrl ||
        `${appUrl}/student/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url:
        cancelUrl || (courseId ? `${appUrl}/courses/${courseId}` : `${appUrl}/courses`),
    };

    if (mode === "subscription") {
      sessionConfig.subscription_data = { metadata };
    } else {
      sessionConfig.payment_intent_data = { metadata };
    }

    const session = await getStripe().checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("[Stripe Checkout Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
