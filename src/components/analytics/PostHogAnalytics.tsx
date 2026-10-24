"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";

const sentVitals = new Set<string>();
const recentErrors = new Map<string, number>();

function metricRating(name: string, value: number): string {
  if (name === "LCP") return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
  if (name === "INP") return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
  if (name === "CLS") return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
  if (name === "FCP") return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
  if (name === "TTFB") return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
  return "unknown";
}

function emitVital(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  const rounded = name === "CLS" ? Math.round(value * 1000) / 1000 : Math.round(value);
  const key = `${Math.floor(performance.timeOrigin)}:${name}`;
  if (sentVitals.has(key)) return;
  sentVitals.add(key);
  trackAnalyticsEvent("ozlind_web_vital", {
    metric_name: name,
    metric_value: rounded,
    metric_rating: metricRating(name, rounded),
  });
}

function captureSafeClientError(errorType: string, source: "window" | "promise"): void {
  const normalizedType = /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(errorType) ? errorType : "Error";
  const key = `${source}:${normalizedType}`;
  const now = Date.now();
  if (now - (recentErrors.get(key) ?? 0) < 30_000) return;
  recentErrors.set(key, now);
  trackAnalyticsEvent("ozlind_client_error", {
    error_type: normalizedType,
    error_source: source,
  });
}

export default function PostHogAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    trackAnalyticsEvent("$pageview", { $title: document.title });
  }, [pathname]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Deliberately omit error.message, stack and source URL to avoid capturing
      // prompts, response fragments, query strings or other user content.
      const errorType = event.error instanceof Error ? event.error.name : "WindowError";
      captureSafeClientError(errorType, "window");
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Never serialize a rejection reason: it may contain server or user text.
      const errorType = event.reason instanceof Error ? event.reason.name : "UnhandledRejection";
      captureSafeClientError(errorType, "promise");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    let largestContentfulPaint = 0;
    let cumulativeLayoutShift = 0;
    let sawLayoutShift = false;
    let maxInteractionLatency = 0;
    let sawInteraction = false;
    const observers: PerformanceObserver[] = [];

    const observe = (type: string, callback: (entries: PerformanceEntry[]) => void) => {
      try {
        if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: true } as PerformanceObserverInit);
        observers.push(observer);
      } catch {
        // Unsupported entries should not affect app behavior.
      }
    };

    observe("paint", (entries) => {
      for (const entry of entries) {
        if (entry.name === "first-contentful-paint") emitVital("FCP", entry.startTime);
      }
    });

    observe("largest-contentful-paint", (entries) => {
      for (const entry of entries) largestContentfulPaint = entry.startTime;
    });

    observe("layout-shift", (entries) => {
      for (const entry of entries) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput && typeof shift.value === "number") {
          cumulativeLayoutShift += shift.value;
          sawLayoutShift = true;
        }
      }
    });

    observe("event", (entries) => {
      for (const entry of entries) {
        const eventEntry = entry as PerformanceEntry & { interactionId?: number; duration: number };
        if ((eventEntry.interactionId ?? 0) > 0) {
          maxInteractionLatency = Math.max(maxInteractionLatency, eventEntry.duration);
          sawInteraction = true;
        }
      }
    });

    const reportTimeToFirstByte = () => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (navigation && navigation.responseStart >= navigation.requestStart) {
        emitVital("TTFB", navigation.responseStart - navigation.requestStart);
      }
    };

    const flushOnHide = () => {
      if (largestContentfulPaint > 0) emitVital("LCP", largestContentfulPaint);
      if (sawLayoutShift) emitVital("CLS", cumulativeLayoutShift);
      if (sawInteraction) emitVital("INP", maxInteractionLatency);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushOnHide();
    };

    if (document.readyState === "complete") reportTimeToFirstByte();
    else window.addEventListener("load", reportTimeToFirstByte, { once: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushOnHide);

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("load", reportTimeToFirstByte);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushOnHide);
    };
  }, []);

  return null;
}
