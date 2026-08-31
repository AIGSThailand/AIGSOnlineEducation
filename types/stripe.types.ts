import type { SubscriptionStatus } from "./database.types";

export interface StripeSubscriptionRecord {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerMappingResult {
  customerId: string;
  isNew: boolean;
}
