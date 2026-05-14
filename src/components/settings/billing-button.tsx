"use client";

import { useState } from "react";
import { CreditCard, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function BillingButton() {
  const { error } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    const result = await api.post<any>("/api/billing/checkout", {});
    setLoading(false);
    if (!result.ok) {
      error(result.error);
      return;
    }
    if (result.data.url) {
      window.location.href = result.data.url;
    } else {
      error("Failed to initiate checkout");
    }
  }

  return (
    <Button onClick={handleCheckout} loading={loading} className="w-full">
      <CreditCard size={16} className="mr-2" /> Upgrade to Pro <ArrowRight size={14} className="ml-2" />
    </Button>
  );
}
