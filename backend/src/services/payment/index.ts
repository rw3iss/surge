import { PaymentProvider } from './types';
import { StripePaymentProvider } from './stripe';

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = new StripePaymentProvider();
  }
  return provider;
}

export type { PaymentProvider } from './types';
export type {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  CreateCustomerParams,
  CustomerResult,
  CreateSubscriptionParams,
  SubscriptionResult,
} from './types';
