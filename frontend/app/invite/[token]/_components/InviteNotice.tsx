import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type NoticeTone = "neutral" | "success" | "danger";

interface InviteNoticeProps {
  tone?: NoticeTone;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

// Tinted icon-circle backgrounds, paired with their strong color per the
// design-token semantics (e.g. bg-primary-light + text-primary). Neutral uses
// the surface/border chrome rather than a brand color.
const TONE_CLASSES: Record<NoticeTone, string> = {
  neutral: "bg-surface border border-border text-muted-text",
  success: "bg-primary-light text-primary",
  danger: "bg-danger-light text-danger",
};

// Icon path per tone — check for success, an info dot for neutral, an alert
// triangle for danger. All inherit `currentColor` via stroke.
const TONE_PATHS: Record<NoticeTone, ReactNode> = {
  neutral: <path d="M12 8h.01M11 12h1v4h1" />,
  success: <path d="M5 12l4 4L19 7" />,
  danger: <path d="M12 9v4m0 4h.01M10.3 4.3 2.5 18a1 1 0 0 0 .87 1.5h17.26a1 1 0 0 0 .87-1.5L13.7 4.3a1 1 0 0 0-1.74 0Z" />,
};

// Shared presentational card for every non-form invite outcome: the invalid
// link, and (in InviteStatusView) the Accepted/Rejected/Expired/Revoked states.
// Pure presentation — callers supply the copy and any CTA.
export function InviteNotice({ tone = "neutral", title, children, action }: InviteNoticeProps) {
  return (
    <Card className="mx-auto max-w-xl">
      <div className="space-y-5 text-center">
        <div
          className={[
            "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
            TONE_CLASSES[tone],
          ].join(" ")}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6 fill-none stroke-current"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {TONE_PATHS[tone]}
          </svg>
        </div>
        <h2 className="font-heading text-xl text-primary-text">{title}</h2>
        <div className="text-sm text-muted-text">{children}</div>
        {action && <div className="flex justify-center pt-1">{action}</div>}
      </div>
    </Card>
  );
}
