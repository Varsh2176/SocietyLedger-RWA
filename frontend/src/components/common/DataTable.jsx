import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

export function DataTable({
  columns = [],
  data = [],
  keyExtractor = (row, idx) => row.id || idx,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching your criteria.',
  emptyAction,
  onRowClick,
  sortKey,
  sortOrder,
  onSort,
  className = '',
}) {
  const isRowClickable = typeof onRowClick === 'function';

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-600">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const canSort = col.sortable && typeof onSort === 'function';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={`px-4 py-3.5 select-none ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${canSort ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
                    onClick={canSort ? () => onSort(col.key) : undefined}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                      }`}
                    >
                      <span>{col.header}</span>
                      {canSort && (
                        <span className="text-slate-400">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ChevronUp size={14} className="text-slate-900" />
                            ) : (
                              <ChevronDown size={14} className="text-slate-900" />
                            )
                          ) : (
                            <ChevronsUpDown size={14} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <LoadingState message="Loading records..." />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = keyExtractor(row, idx);
                return (
                  <tr
                    key={key}
                    onClick={isRowClickable ? () => onRowClick(row) : undefined}
                    className={`transition-colors ${
                      isRowClickable
                        ? 'cursor-pointer hover:bg-slate-50 focus:outline-none focus:bg-slate-50'
                        : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-slate-700 ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {col.render ? col.render(row, idx) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
