import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext, RequestContextError } from "@/server/context";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    if (!stripeKey || !priceId) {
      throw new RequestContextError("Stripe checkout is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.", 503);
    }

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      client_reference_id: context.workspaceId,
      "metadata[workspace_id]": context.workspaceId,
      "metadata[user_id]": context.userId
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const session = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !session.url) {
      throw new RequestContextError(session.error?.message ?? "Stripe checkout session could not be created.", 502);
    }

    return apiOk({
      mode: "test",
      configured: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    return apiError(error);
  }
}
