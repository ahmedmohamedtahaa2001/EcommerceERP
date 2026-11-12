export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Numbered pagination with previous/next; hides when there is one page. */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const windowSize = 5;
  const start = Math.max(1, Math.min(page - 2, totalPages - windowSize + 1));
  const pages: number[] = [];
  for (
    let index = start;
    index < start + windowSize && index <= totalPages;
    index += 1
  ) {
    pages.push(index);
  }

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-center gap-1 ${className}`}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-9 rounded px-3 text-body2 font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-40"
      >
        ‹
      </button>
      {pages.map((number) => (
        <button
          key={number}
          type="button"
          aria-current={number === page ? "page" : undefined}
          onClick={() => onPageChange(number)}
          className={`h-9 min-w-9 rounded px-2 text-body2 font-semibold ${
            number === page
              ? "bg-primary text-white"
              : "text-ink-700 hover:bg-ink-100"
          }`}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-9 rounded px-3 text-body2 font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-40"
      >
        ›
      </button>
    </nav>
  );
}
