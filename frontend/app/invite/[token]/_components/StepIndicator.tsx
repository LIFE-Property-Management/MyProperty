import { STEP_TITLES, type StepIndex } from "../_lib/schema";

interface StepIndicatorProps {
  current: StepIndex;
}

export function StepIndicator({ current }: StepIndicatorProps) {
  const total = STEP_TITLES.length;

  return (
    <nav aria-label="Invite progress" className="w-full">
      <ol className="flex items-center gap-2 md:gap-4">
        {STEP_TITLES.map((title, idx) => {
          const state: "done" | "current" | "upcoming" =
            idx < current ? "done" : idx === current ? "current" : "upcoming";
          return (
            <li key={title} className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  aria-current={state === "current" ? "step" : undefined}
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    state === "done" && "bg-primary text-white",
                    state === "current" && "bg-primary text-white ring-2 ring-primary-light",
                    state === "upcoming" && "bg-surface text-muted-text border border-border",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {idx + 1}
                </span>
                <span
                  className={[
                    "hidden md:inline text-sm",
                    state === "upcoming" ? "text-muted-text" : "text-primary-text",
                  ].join(" ")}
                >
                  {title}
                </span>
              </div>
              {idx < total - 1 && (
                <div
                  className={[
                    "mt-2 h-0.5 w-full rounded",
                    idx < current ? "bg-primary" : "bg-border",
                  ].join(" ")}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted-text md:hidden">
        Step {current + 1} of {total}: {STEP_TITLES[current]}
      </p>
    </nav>
  );
}
