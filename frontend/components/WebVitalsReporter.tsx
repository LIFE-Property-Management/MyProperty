"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      console.log("[web-vitals]", metric.name, Math.round(metric.value), metric);
      return;
    }
    const endpoint = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;
    if (!endpoint) return;
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
      path: window.location.pathname,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body);
    } else {
      fetch(endpoint, { body, method: "POST", keepalive: true });
    }
  });

  return null;
}
