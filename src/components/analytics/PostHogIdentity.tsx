"use client";

import { useEffect } from "react";
import { identifyAnalyticsUser } from "@/lib/analytics";

export default function PostHogIdentity({ userId }: { userId: string }) {
  useEffect(() => {
    const identify = () => identifyAnalyticsUser(userId);
    identify();
    window.addEventListener("ozlind:analytics-consent-changed", identify);
    return () => window.removeEventListener("ozlind:analytics-consent-changed", identify);
  }, [userId]);

  return null;
}
