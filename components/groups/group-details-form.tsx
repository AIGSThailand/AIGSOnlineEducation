"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createGroupAction, updateGroupAction } from "@/features/groups/actions";
import type { GroupDetail } from "@/features/groups/types";

type Mode = { kind: "create" } | { kind: "edit"; group: GroupDetail };

export function GroupDetailsForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const group = mode.kind === "edit" ? mode.group : null;
  const [name, setName] = useState(group?.name || "");
  const [slug, setSlug] = useState(group?.slug || "");
  const [description, setDescription] = useState(group?.description || "");
  const [status, setStatus] = useState<"active" | "archived">(group?.status || "active");
  const [stripeProductId, setStripeProductId] = useState(group?.stripeProductId || "");
  const [stripePriceId, setStripePriceId] = useState(group?.stripePriceId || "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      if (mode.kind === "create") {
        const result = await createGroupAction({ name, slug, description, status });
        if (!result.success) {
          setError(result.error);
          return;
        }
        router.push(`/admin/groups/${result.data!.id}`);
        return;
      }

      const result = await updateGroupAction({
        groupId: mode.group.id,
        name,
        slug,
        description,
        status,
        stripeProductId,
        stripePriceId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <Label htmlFor="group-name">Name</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Gemology starter bundle"
        />
      </div>
      <div>
        <Label htmlFor="group-slug">Slug</Label>
        <Input
          id="group-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="auto-from-name if empty on create"
        />
      </div>
      <div>
        <Label htmlFor="group-description">Description</Label>
        <Textarea
          id="group-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>
      <div>
        <Label htmlFor="group-status">Status</Label>
        <Select
          id="group-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "active" | "archived")}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      {mode.kind === "edit" ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Commerce (Stripe bundle)</h3>
          <p className="text-xs text-slate-500">
            One price enrolls the buyer into every course attached to this group.
          </p>
          <div>
            <Label htmlFor="stripe-product">Stripe product ID</Label>
            <Input
              id="stripe-product"
              value={stripeProductId}
              onChange={(e) => setStripeProductId(e.target.value)}
              placeholder="prod_…"
            />
          </div>
          <div>
            <Label htmlFor="stripe-price">Stripe price ID</Label>
            <Input
              id="stripe-price"
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_…"
            />
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Saved.</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : mode.kind === "create" ? "Create group" : "Save changes"}
      </Button>
    </form>
  );
}
