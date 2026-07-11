import type Stripe from 'stripe';

/**
 * Stripe API-object shape shims.
 *
 * Bumping the `stripe` npm package (14 → 22) advances the SDK's *type*
 * definitions to Stripe's latest API version, but the wire response shape is
 * governed by the account's pinned API version — not the installed package.
 * Several fields moved between versions:
 *   - Subscription.current_period_{start,end} → subscription item level
 *   - Invoice.subscription                    → invoice.parent.subscription_details
 *   - Invoice.payment_intent                  → invoice.payments[] / confirmation_secret
 *
 * These helpers read from whichever location the live response actually
 * populates, so behavior is unchanged on the current account version and stays
 * correct if the account's API version is later upgraded.
 */

type SubWithPeriod = Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
    items?: { data?: Array<{ current_period_start?: number; current_period_end?: number; }>; };
};

/** Billing-period bounds (unix seconds): top-level (older) or first item (newer). */
export function subscriptionPeriod(sub: Stripe.Subscription,): { start: number; end: number; } {
    const s = sub as SubWithPeriod;
    const item = s.items?.data?.[0];
    return {
        start: s.current_period_start ?? item?.current_period_start ?? 0,
        end: s.current_period_end ?? item?.current_period_end ?? 0,
    };
}

type InvoiceLinks = Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    payment_intent?: string | Stripe.PaymentIntent | null;
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null; }; } | null;
    payments?: { data?: Array<{ payment?: { payment_intent?: string | Stripe.PaymentIntent | null; }; }>; } | null;
    confirmation_secret?: { client_secret?: string | null; } | null;
};

function idOf(v: string | { id: string; } | null | undefined,): string | null {
    if (!v) return null;
    return typeof v === 'string' ? v : v.id;
}

/** Subscription id linked to an invoice (top-level, older; parent, newer). */
export function invoiceSubscriptionId(inv: Stripe.Invoice,): string | null {
    const i = inv as InvoiceLinks;
    return idOf(i.subscription ?? i.parent?.subscription_details?.subscription ?? null,);
}

/** PaymentIntent id linked to an invoice (top-level, older; payments[], newer). */
export function invoicePaymentIntentId(inv: Stripe.Invoice,): string | null {
    const i = inv as InvoiceLinks;
    return idOf(i.payment_intent ?? i.payments?.data?.[0]?.payment?.payment_intent ?? null,);
}

/** Client secret to confirm a subscription's first payment (expanded PI, older; confirmation_secret, newer). */
export function invoiceClientSecret(inv: Stripe.Invoice,): string | undefined {
    const i = inv as InvoiceLinks;
    const pi = i.payment_intent;
    if (pi && typeof pi !== 'string' && pi.client_secret) return pi.client_secret;
    if (i.confirmation_secret?.client_secret) return i.confirmation_secret.client_secret;
    return undefined;
}
