import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export async function writeAdminAuditEvent(options: {
  actorId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("admin_audit_events").insert({
    actor_id: options.actorId,
    action: options.action,
    target_user_id: options.targetUserId ?? null,
    metadata: (options.metadata || {}) as Json,
  } as never);

  if (error) {
    // Never fail the primary admin action because audit insert failed — log only.
    console.error("[admin_audit_events]", error.message);
  }
}
