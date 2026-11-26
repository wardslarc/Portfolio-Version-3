"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { excludeAdminBeforeSend } from "@/lib/analytics";

export default function Telemetry() {
  return (
    <>
      <Analytics beforeSend={excludeAdminBeforeSend} />
      <SpeedInsights beforeSend={excludeAdminBeforeSend} />
    </>
  );
}
