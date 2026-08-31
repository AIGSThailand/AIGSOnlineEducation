import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, { message: "Price ID is required." }),
  courseId: z.string().uuid().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
