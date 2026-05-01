import { type ReactNode } from "react";

export interface PaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getPageRange(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const always = new Set([1, 2, totalPages - 1, totalPages]);
  const around = new Set(
    [page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages),
  );
  const visible = new Set([...always, ...around]);
  const sorted = [...visible].sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }
  return result;
}

const BUTTON_BASE =
  "inline-flex items-center justify-center w-8 h-8 rounded-md border text-sm " +
  "transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const BUTTON_ACTIVE =
  "bg-primary text-white border-primary cursor-default disabled:opacity-75";

const BUTTON_INACTIVE =
  "bg-surface text-primary-text border-border hover:bg-neutral-light cursor-pointer";

export function Pagination({
  page,
  totalCount,
  pageSize,
  onPageChange,
  className,
}: PaginationProps): ReactNode {
  if (totalCount <= pageSize) return null;

  const totalPages = Math.ceil(totalCount / pageSize);
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const pageRange = getPageRange(page, totalPages);

  return (
    <div
      className={
        "flex items-center justify-between gap-4 mt-3" +
        (className ? " " + className : "")
      }
    >
      <p className="text-sm text-muted-text">
        Showing {rangeStart}–{rangeEnd} of {totalCount}
      </p>
      <div className="flex items-center gap-1.5" role="navigation" aria-label="Pagination">
        {pageRange.map((item, i) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="inline-flex items-center justify-center w-8 h-8 text-sm text-muted-text"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              disabled={item === page}
              className={BUTTON_BASE + " " + (item === page ? BUTTON_ACTIVE : BUTTON_INACTIVE)}
              onClick={item === page ? undefined : () => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export default Pagination;
