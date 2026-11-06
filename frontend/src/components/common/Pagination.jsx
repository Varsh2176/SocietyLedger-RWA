import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button';

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems,
  pageSize = 10,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1 && !totalItems) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems || currentPage * pageSize);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const left = Math.max(1, currentPage - 1);
      const right = Math.min(totalPages, currentPage + 1);

      if (left > 2) {
        pages.push(1);
        if (left > 3) pages.push('...');
      } else {
        for (let i = 1; i < left; i++) pages.push(i);
      }

      for (let i = left; i <= right; i++) pages.push(i);

      if (right < totalPages - 1) {
        if (right < totalPages - 2) pages.push('...');
        pages.push(totalPages);
      } else {
        for (let i = right + 1; i <= totalPages; i++) pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div
      className={`flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 ${className}`}
    >
      <div>
        {totalItems ? (
          <span>
            Showing <strong className="font-semibold text-slate-900">{startItem}</strong> to{' '}
            <strong className="font-semibold text-slate-900">{endItem}</strong> of{' '}
            <strong className="font-semibold text-slate-900">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-slate-900">{currentPage}</strong> of{' '}
            <strong className="font-semibold text-slate-900">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="p-1.5 h-8 w-8"
          title="First Page"
          aria-label="First Page"
        >
          <ChevronsLeft size={14} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 h-8 w-8"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft size={14} />
        </Button>

        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((page, idx) =>
            typeof page === 'number' ? (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`h-8 min-w-[32px] px-2 rounded-md font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={`dots-${idx}`} className="px-1 text-slate-400">
                ...
              </span>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 h-8 w-8"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight size={14} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-1.5 h-8 w-8"
          title="Last Page"
          aria-label="Last Page"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>
    </div>
  );
}
