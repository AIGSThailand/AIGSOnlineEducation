import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  priceId: z.string().optional(),
  courseId: z.string().uuid().optional(),
  courseTitle: z.string().optional(),
  amount: z.number().positive().optional(), // Amount in cents if dynamic
  currency: z.string().default("usd").optional(),
  mode: z.enum(["payment", "subscription"]).default("payment").optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
