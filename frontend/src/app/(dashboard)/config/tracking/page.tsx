"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Activity, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { trackingApi, AuditLog } from "@/lib/api/restaurant/trackingApi";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
} from "@/lib/dashboard-ui";

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  LOGIN: { bg: "bg-emerald-50", text: "text-emerald-600" },
  LOGOUT: { bg: "bg-rose-50", text: "text-rose-600" },
  CREATE: { bg: "bg-blue-50", text: "text-blue-600" },
  UPDATE: { bg: "bg-amber-50", text: "text-amber-600" },
  DELETE: { bg: "bg-rose-50", text: "text-rose-600" },
  AUTH: { bg: "bg-indigo-50", text: "text-indigo-600" }
};

export default function TrackingPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({
    start: "",
    end: ""
  });
  const { showToast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await trackingApi.getAllLogs();
      setLogs(data || []);
    } catch (error) {
      console.error("Failed to fetch logs", error);
      showToast("Error loading activity logs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto refresh every 60 seconds
    const interval = setInterval(fetchLogs, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.entity.toLowerCase().includes(search.toLowerCase()) ||
        log.description.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.fullName.toLowerCase().includes(search.toLowerCase());

      const matchesAction =
        actionFilter === "all" ||
        log.action.toLowerCase().includes(actionFilter.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter.start || dateFilter.end) {
        const logDate = new Date(log.createdAt).toISOString().split('T')[0];
        if (dateFilter.start && logDate < dateFilter.start) matchesDate = false;
        if (dateFilter.end && logDate > dateFilter.end) matchesDate = false;
      }

      return matchesSearch && matchesDate && matchesAction;
    });
  }, [logs, search, dateFilter, actionFilter]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, dateFilter, actionFilter]);

  const getActionStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE')) return ACTION_COLORS.CREATE;
    if (act.includes('UPDATE')) return ACTION_COLORS.UPDATE;
    if (act.includes('DELETE')) return ACTION_COLORS.DELETE;
    if (act.includes('LOGIN')) return ACTION_COLORS.LOGIN;
    if (act.includes('LOGOUT')) return ACTION_COLORS.LOGOUT;
    return { bg: "bg-zinc-100", text: "text-zinc-600" };
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={cn(pageHeaderWrapperClass, "flex flex-col md:flex-row md:items-center justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Activity Tracking</h1>
        </div>
        <button 
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white border border-zinc-100 text-[#64748B] hover:text-primary hover:bg-zinc-50 transition-all shadow-sm text-xs font-black uppercase tracking-widest"
        >
          <RefreshCcw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh Log
        </button>
      </div>

      {/* Main Table Box */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Controls Row */}
        <div className="px-8 py-4 flex flex-wrap items-center gap-6 border-b border-zinc-50 bg-zinc-50/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
                <span>Show</span>
                <select 
                    value={pageSize} 
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="w-16 h-[38px] px-2 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
                >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
              <span>Filter Action</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-36 h-[38px] px-3 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
              >
                <option value="all">All Events</option>
                <option value="login">Login</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-md shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">From:</span>
                <input 
                    type="date" 
                    value={dateFilter.start}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-transparent text-[11px] font-bold text-zinc-600 outline-none cursor-pointer"
                />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-md shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">To:</span>
                <input 
                    type="date" 
                    value={dateFilter.end}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-transparent text-[11px] font-bold text-zinc-600 outline-none cursor-pointer"
                />
            </div>
            {(dateFilter.start || dateFilter.end) && (
                <button 
                    onClick={() => setDateFilter({ start: "", end: "" })}
                    className="text-[10px] font-bold text-rose-500 uppercase hover:underline ml-1"
                >
                    Clear
                </button>
            )}
          </div>

          <div className="flex-1"></div>

          <div className="flex items-center gap-3">
            <div className="relative w-72 group">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search who or what..."
                className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, "text-left w-16")}>No</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Actor</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-center")}>Event</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Description</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Module</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Date/Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="h-16 animate-pulse bg-muted/5"><TableCell colSpan={6} /></TableRow>
                ))
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map((log, index) => {
                  const style = getActionStyle(log.action);
                  return (
                    <TableRow key={log.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-bold text-primary">
                          {(currentPage - 1) * pageSize + index + 1}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <div>
                          <p className="text-[13px] font-normal text-zinc-800 leading-tight uppercase tracking-tight">{log.user?.fullName || "System"}</p>
                          <p className="text-[10px] text-zinc-400 font-medium lowercase italic">{log.user?.email || "automated"}</p>
                        </div>
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-center")}>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          style.text
                        )}>
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <p className="text-[12px] font-medium text-zinc-600 leading-relaxed max-w-sm">
                          {log.description}
                        </p>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                          {log.entity}
                        </span>
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[11px] font-normal text-zinc-800">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[9px] font-normal text-zinc-400 uppercase">
                            {new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="size-16 rounded-full bg-zinc-50 flex items-center justify-center shadow-inner">
                        <Activity className="size-8 text-zinc-100" />
                      </div>
                      <p className="text-zinc-400 font-black uppercase text-[11px] tracking-widest">No activity logs recorded yet</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer info */}
        <div className="px-8 py-4 bg-zinc-50/50 border-t border-zinc-100 flex justify-between items-center">
            <p className="text-[12px] font-medium text-zinc-500">
              {filteredLogs.length > 0
                ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredLogs.length)} of ${filteredLogs.length}`
                : "No records"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <span className="text-xs font-medium text-zinc-500">{currentPage} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
