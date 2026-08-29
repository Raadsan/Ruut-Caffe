'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  dashboardCardClass,
  dashboardControlsRowClass,
  dashboardInputClass,
  dashboardLabelClass,
  dashboardNativeThClass,
  dashboardNativeTheadClass,
  dashboardPaginationClass,
  dashboardSelectClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableWrapClass,
} from '@/lib/dashboard-ui';

export type DashboardTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
};

type Props<T extends { id: number }> = {
  rows: T[];
  columns: DashboardTableColumn<T>[];
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  action?: ReactNode;
  filters?: ReactNode;
  emptyText?: string;
  minWidth?: string;
  pageSizes?: number[];
  footer?: ReactNode;
};

export default function DashboardDataTable<T extends { id: number }>({
  rows,
  columns,
  loading = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  action,
  filters,
  emptyText = 'No records found',
  minWidth = '900px',
  pageSizes = [10, 25, 50, 100],
  footer,
}: Props<T>) {
  const [pageSize, setPageSize] = useState(pageSizes[0] || 10);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [currentPage, pageSize, rows]);

  useEffect(() => { setCurrentPage(1); }, [searchValue, pageSize]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const start = rows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, rows.length);
  const align = (value?: 'left' | 'center' | 'right') => value === 'right' ? 'text-right' : value === 'center' ? 'text-center' : 'text-left';

  return (
    <section className={dashboardCardClass}>
      <div className={dashboardControlsRowClass}>
        <div className="flex items-center gap-2">
          <span className={dashboardLabelClass}>Show</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className={`${dashboardSelectClass} w-16`}>
            {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        {filters && <div className="flex flex-1 flex-wrap items-center gap-2">{filters}</div>}
        {!filters && <div className="flex-1" />}
        <div className="flex items-center gap-3">
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} className={dashboardInputClass} />
          </div>
          {action}
        </div>
      </div>

      <div className={dashboardTableWrapClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth }}>
            <thead className={dashboardNativeTheadClass}>
              <tr>{columns.map((column) => <th key={column.key} className={`${dashboardNativeThClass} ${align(column.align)} ${column.className || ''}`}>{column.header}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }, (_, row) => (
                <tr key={row} className={dashboardTableBodyRowClass}>
                  {columns.map((column) => <td key={column.key} className={dashboardTableCellClass}><div className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></td>)}
                </tr>
              )) : pageRows.length ? pageRows.map((row) => (
                <tr key={row.id} className={dashboardTableBodyRowClass}>
                  {columns.map((column) => <td key={column.key} className={`${dashboardTableCellClass} ${align(column.align)} ${column.className || ''}`}>{column.cell(row)}</td>)}
                </tr>
              )) : (
                <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-white/70">{emptyText}</td></tr>
              )}
            </tbody>
            {footer}
          </table>
        </div>
      </div>

      <div className={dashboardPaginationClass}>
        <span>{start}–{end} of {rows.length}</span>
        <div className="flex items-center gap-1">
          <button aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="flex size-7 items-center justify-center rounded-md border bg-white text-zinc-500 disabled:opacity-40 dark:bg-card dark:text-white"><ChevronLeft className="size-3.5" /></button>
          <span className="rounded-md border bg-white px-3 py-1.5 dark:bg-card dark:text-white">{currentPage} of {totalPages}</span>
          <button aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="flex size-7 items-center justify-center rounded-md border bg-white text-zinc-500 disabled:opacity-40 dark:bg-card dark:text-white"><ChevronRight className="size-3.5" /></button>
        </div>
      </div>
    </section>
  );
}
