"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface SubscribeButtonProps {
  priceId: string;
  courseId?: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
}

export function SubscribeButton({
  priceId,
  courseId,
  label = "Subscribe Now",
  className,
  variant = "primary",
}: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCheckout() {
    try {
      setLoading(true);
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, courseId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        alert(data.error || "Failed to start checkout");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert("Something went wrong initiating checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleCheckout} disabled={loading} variant={variant} className={className}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
