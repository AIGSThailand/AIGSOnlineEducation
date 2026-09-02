"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface BuyCourseButtonProps {
  courseId: string;
  courseTitle: string;
  priceId?: string;
  amount?: number; // e.g. 199 for $199
  currency?: string;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline";
}

export function BuyCourseButton({
  courseId,
  courseTitle,
  priceId,
  amount,
  currency = "usd",
  label = "Enroll Now (One-Time Payment)",
  className = "w-full",
  size = "lg",
  variant = "primary",
}: BuyCourseButtonProps) {
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
          courseId,
          courseTitle,
          priceId: priceId || undefined,
          amount: amount || undefined,
          currency,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/courses/${courseId}`);
          return;
        }
        alert(data.error || "Failed to initiate payment");
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
    <Button
      onClick={handleBuy}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
