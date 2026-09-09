"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface BuyBundleButtonProps {
  groupId: string;
  priceId?: string;
  label?: string;
  className?: string;
}

export function BuyBundleButton({
  groupId,
  priceId,
  label = "Buy bundle",
  className = "w-full",
}: BuyBundleButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleBuy() {
    try {
      setLoading(true);
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "payment",
          groupId,
          priceId: priceId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/bundles/${groupId}`);
          return;
        }
        alert(data.error || "Failed to initiate payment");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Something went wrong initiating checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleBuy} disabled={loading} className={className} size="lg">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
