/** Shared dashboard page layout & table action button styles (Rooms page standard). */

export const dashboardPageClass =
  "animate-in fade-in duration-700 mx-1 pt-0 pb-8";

export const dashboardPageStyle = {
  fontFamily: "var(--font-poppins), sans-serif",
} as const;

export const pageHeaderTitleClass =
  "text-2xl font-semibold text-[#1e293b] dark:text-white tracking-tight";

/** Compact title in top layout bar. */
export const pageHeaderBarTitleClass =
  "text-sm font-semibold tracking-tight text-[#1e293b] dark:text-white";

/** Smaller page/section title (e.g. POS sidebar). */
export const pageHeaderTitleCompactClass =
  "text-lg font-semibold text-[#1e293b] dark:text-white tracking-tight";

export const pageHeaderSubtitleClass =
  "text-[12px] text-zinc-500 dark:text-white/80 uppercase tracking-wider mt-1 font-medium";

/** Page title block — same layout on every page. */
export const pageHeaderWrapperClass = "mb-6 px-4";

/** Main content card wrapper (tables, lists). */
export const dashboardCardClass =
  "bg-white dark:bg-card rounded-xl border border-zinc-200 dark:border-border shadow-sm overflow-hidden";

/** Controls row inside a card. */
export const dashboardControlsRowClass =
  "px-8 py-4 flex flex-wrap items-center gap-6 border-b border-zinc-50 dark:border-border";

/** Table area inside a card. */
export const dashboardTableWrapClass =
  "border-t border-zinc-100 dark:border-border overflow-hidden bg-white dark:bg-card";

/** Pagination footer. */
export const dashboardPaginationClass =
  "py-2 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-zinc-400 dark:text-white/70 border-t border-zinc-100 dark:border-border bg-zinc-50/30 dark:bg-card/80";

/** Form controls — select, input in toolbar. */
export const dashboardSelectClass =
  "h-[42px] px-2 border border-zinc-200 dark:border-[#2a2a2a] rounded-md outline-none focus:border-primary transition-colors bg-white dark:bg-[#161616] cursor-pointer text-sm font-normal text-zinc-600 dark:text-white";

export const dashboardInputClass =
  "w-full h-[42px] pl-10 pr-4 bg-zinc-50 dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600 dark:text-white placeholder:dark:text-white/40";

/** Table cell text helpers. */
export const dashboardTextPrimary =
  "text-[13px] font-medium text-zinc-700 dark:text-white";

export const dashboardTextSecondary =
  "text-[13px] font-medium text-zinc-600 dark:text-white/90";

export const dashboardTextMuted =
  "text-[13px] text-zinc-500 dark:text-white/70";

export const dashboardLabelClass =
  "text-[13px] text-zinc-400 dark:text-white/60 font-normal shrink-0";

/** Dashboard table — primary header (light); dark header + white text in dark mode. */
export const dashboardTableHeaderClass =
  "bg-primary dark:bg-[#1e1e1e] border-b border-primary dark:border-[#2a2a2a]";
export const dashboardTableHeadRowClass = "hover:bg-transparent border-none";
export const dashboardTableHeadClass =
  "px-6 py-3.5 text-[11px] font-bold uppercase text-white dark:text-white tracking-wider border-none";
export const dashboardTableBodyRowClass =
  "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors";
export const dashboardTableCellClass = "px-6 py-3 text-foreground dark:text-white";

/** Chart colors — primary family, no blue. */
export const chartPrimary = "#012e67";
export const chartPrimaryMid = "#022d71";
export const chartPrimaryLight = "#6f95c8";
export const chartPrimaryVariants = [
  chartPrimary,
  "#022d71",
  "#174f91",
  "#3b73ae",
  chartPrimaryLight,
] as const;

export const chartTooltipStyle = {
  backgroundColor: chartPrimary,
  borderColor: chartPrimary,
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#ffffff",
} as const;

/** Recharts axis tick — uses --chart-tick CSS variable (white in dark mode). */
export const chartAxisTick = {
  fontSize: 10,
  fontWeight: 700,
  fill: "var(--chart-tick)",
} as const;

export const chartAxisTickSm = {
  fontSize: 10,
  fontWeight: 600,
  fill: "var(--chart-tick)",
} as const;

/** Table row ID / No column. */
export const dashboardTableIdClass =
  "text-[13px] font-bold text-primary dark:text-white";

/** Status badge — solid style (Users page standard). */
export const dashboardStatusBadgeClass =
  "px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-md";

export function getTableStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "inactive":
      return "bg-rose-600 text-white";
    default:
      // active, occupied, or any legacy value → Active (green)
      return "bg-emerald-600 text-white";
  }
}

export function getTableStatusLabel(status: string): string {
  return status.toLowerCase() === "inactive" ? "Inactive" : "Active";
}

export function getOrderStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "paid":
    case "served":
    case "completed":
      return "bg-emerald-600 text-white";
    case "preparing":
    case "ready":
      return "bg-blue-600 text-white";
    case "pending":
      return "bg-amber-500 text-white";
    case "cancelled":
      return "bg-rose-600 text-white";
    case "held":
      return "bg-zinc-500 text-white";
    default:
      return "bg-zinc-500 text-white";
  }
}

export function formatStatusLabel(status: string): string {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Native `<table>` header — same primary style as shadcn Table. */
export const dashboardNativeTheadClass =
  "bg-primary dark:bg-[#1e1e1e] border-b border-primary dark:border-[#2a2a2a]";
export const dashboardNativeThClass =
  "px-6 py-3.5 text-[11px] font-bold uppercase text-white dark:text-white tracking-wider border-none";

export function getStockStatusBadgeClass(kind: "in" | "low" | "out"): string {
  switch (kind) {
    case "out":
      return "bg-rose-600 text-white";
    case "low":
      return "bg-amber-500 text-white";
    default:
      return "bg-emerald-600 text-white";
  }
}

/** Stat card icon — different soft primary tints, white icon. */
const dashboardStatIconBaseClass =
  "w-fit shrink-0 self-start p-2.5 rounded-xl text-white shadow-md shadow-primary/15 transition-all group-hover:scale-110 group-hover:brightness-105 [&_svg]:text-white";

/** Full primary (left) → lighter primary (right). */
export const dashboardStatIconBgVariants = [
  "bg-[#012e67]",
  "bg-[#022d71]",
  "bg-[#174f91]",
  "bg-[#3b73ae]",
  "bg-[#6f95c8]",
] as const;

export function dashboardStatIconClass(index = 0): string {
  const bg =
    dashboardStatIconBgVariants[index % dashboardStatIconBgVariants.length];
  return `${dashboardStatIconBaseClass} ${bg}`;
}

export const actionBtnView =
  "h-8 w-8 p-0 text-primary dark:text-white [&_svg]:dark:text-white hover:!text-emerald-600 dark:hover:!text-white hover:!bg-emerald-50 dark:hover:!bg-white/10 rounded-lg transition-colors";

export const actionBtnEdit =
  "h-8 w-8 p-0 text-primary dark:text-white [&_svg]:dark:text-white hover:!text-blue-600 dark:hover:!text-white hover:!bg-blue-50 dark:hover:!bg-white/10 rounded-lg transition-colors";

export const actionBtnDelete =
  "h-8 w-8 p-0 text-rose-600 dark:text-white [&_svg]:dark:text-white hover:text-rose-600 dark:hover:text-white hover:bg-rose-50 dark:hover:bg-white/10 rounded-lg transition-colors";

/** Solid red confirm button — keeps white text on hover (overrides default Button variant). */
export const btnConfirmDelete =
  "bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none shadow-lg shadow-rose-600/10";

/** Page header create / add button — primary in light; #cccccc + dark text in dark mode. */
export const btnCreatePage =
  "h-[42px] px-6 bg-primary !text-white hover:bg-primary/90 hover:!text-white dark:bg-[#cccccc] dark:!text-[#161616] dark:hover:bg-[#b8b8b8] dark:hover:!text-[#161616] rounded-md flex items-center gap-2 transition-all font-medium text-sm shadow-sm hover:shadow-md hover:shadow-primary/20 dark:shadow-none border-none dark:border dark:border-[#2a2a2a]";

/** Modal create / save submit button. */
export const btnCreateSubmit =
  "bg-primary !text-white hover:bg-primary/90 hover:!text-white dark:bg-[#cccccc] dark:!text-[#161616] dark:hover:bg-[#b8b8b8] dark:hover:!text-[#161616] rounded-lg font-bold border-none dark:border dark:border-[#2a2a2a] px-8 h-11 shadow-md shadow-primary/15 dark:shadow-none disabled:opacity-70 transition-all";

/** Modal cancel button. */
export const btnModalCancel =
  "rounded-md font-bold px-6 h-11 dark:bg-[#cccccc] dark:!text-[#161616] dark:border dark:border-[#2a2a2a] dark:hover:bg-[#b8b8b8] dark:hover:!text-[#161616]";

/** Order card — light primary view button. */
export const btnViewOrder =
  "h-9 px-3.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:!text-primary font-semibold text-[12px] shadow-sm transition-all gap-1.5";

/** Order card — light blue edit button. */
export const btnEditOrder =
  "h-9 w-9 p-0 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 hover:!text-blue-700 transition-all shrink-0";
