'use client';

import { useEffect, useState } from 'react';
import { accountingDashboardApi, type AccountingDashboardData } from '@/lib/api/accounting/accountingDashboardApi';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ChevronDown,
  CircleDollarSign,
  Landmark,
  MoreVertical,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BRAND = '#012e67';
const BLUSH = '#022d71';
const ROSE = '#174f91';

const periods = ['This Month', 'Last Month', 'This Quarter'];

const stats = [
  { label: 'Total Revenue', value: '$8,172', change: '16.1%', trend: 'up', icon: CircleDollarSign, tone: 'brand' },
  { label: 'Expenses', value: '$1,801', change: '4.2%', trend: 'down', icon: ReceiptText, tone: 'rose' },
  { label: 'Net Profit', value: '$6,371', change: '20.4%', trend: 'up', icon: Banknote, tone: 'brand' },
  { label: 'Cash Balance', value: '$4,416', change: '18.2%', trend: 'up', icon: WalletCards, tone: 'blush' },
  { label: 'Bank Balance', value: '$9,215', change: '7.6%', trend: 'up', icon: Landmark, tone: 'brand' },
] as const;

function PeriodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <select
        aria-label="Select reporting period"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 appearance-none rounded-lg border bg-background pl-3 pr-9 text-xs font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
      >
        {periods.map((period) => <option key={period}>{period}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

type LiveStat = Omit<(typeof stats)[number], 'value' | 'trend'> & { value: string; trend: 'up' | 'down' };

function StatCard({ stat }: { stat: LiveStat }) {
  const Icon = stat.icon;
  const positive = stat.trend === 'up';
  const colors = stat.tone === 'rose'
    ? 'bg-rose-50 text-[#174f91] dark:bg-[#174f91]/10'
    : stat.tone === 'blush'
      ? 'bg-[#022d71]/15 text-[#022d71]'
      : 'bg-primary/8 text-primary';

  return (
    <article className="group min-w-0 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${colors}`}><Icon className="size-4.5" /></span>
          <span className="truncate text-xs font-medium text-muted-foreground">{stat.label}</span>
        </div>
        <button aria-label={`More options for ${stat.label}`} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"><MoreVertical className="size-4" /></button>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <p className="text-[1.35rem] font-bold tracking-tight tabular-nums">{stat.value}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            {positive ? <ArrowUpRight className="size-3 text-emerald-600" /> : <ArrowDownRight className="size-3 text-rose-500" />}
            <span className={positive ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-500'}>{stat.change}</span>
            <span>vs last month</span>
          </div>
        </div>
        <svg viewBox="0 0 72 32" className="h-8 w-[72px] overflow-visible" aria-hidden="true">
          <path d={stat.tone === 'rose' ? 'M1 27 L18 27 L27 7 L36 26 L45 4 L54 10 L70 28' : 'M1 27 L17 27 L29 22 L41 25 L53 6 L70 27'} fill="none" stroke={stat.tone === 'rose' ? ROSE : BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </article>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
      <p className="mb-2 font-semibold">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="mt-1 flex min-w-32 items-center justify-between gap-5 text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: item.color }} />{item.name}</span>
          <span className="font-semibold text-foreground">${item.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, period, onPeriodChange, children }: { title: string; period: string; onPeriodChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <PeriodSelect value={period} onChange={onPeriodChange} />
      </div>
      {children}
    </section>
  );
}

export default function AccountingDashboardPage() {
  const [period, setPeriod] = useState('This Month');
  const [summary, setSummary] = useState<AccountingDashboardData | null>(null);
  const data = summary?.chartData || [];
  const expenseBreakdown = summary?.expenseBreakdown || [];
  const transactions = summary?.recentTransactions || [];
  const updatedAt = summary?.updatedAt
    ? new Date(summary.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Loading...';
  const liveStats = [
    { ...stats[0], value: summary ? `$${summary.totalRevenue.toLocaleString()}` : 'Loading...' },
    { ...stats[1], value: summary ? `$${summary.expenses.toLocaleString()}` : 'Loading...' },
    { ...stats[2], value: summary ? `$${summary.netProfit.toLocaleString()}` : 'Loading...', trend: (summary?.netProfit || 0) >= 0 ? 'up' as const : 'down' as const },
    { ...stats[3], value: summary ? `$${summary.cashBalance.toLocaleString()}` : 'Loading...', trend: (summary?.cashBalance || 0) >= 0 ? 'up' as const : 'down' as const },
    { ...stats[4], value: summary ? `$${summary.bankBalance.toLocaleString()}` : 'Loading...', trend: (summary?.bankBalance || 0) >= 0 ? 'up' as const : 'down' as const },
  ];

  useEffect(() => {
    accountingDashboardApi.getSummary(period).then(setSummary).catch((error) => {
      console.error('Failed to load accounting dashboard', error);
    });
  }, [period]);

  return (
    <main className="dashboard-scope min-h-full bg-background p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Accounting Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
          <span className="size-2 rounded-full bg-emerald-500" /> Last updated {updatedAt}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {liveStats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <ChartCard title="Revenue vs Expense" period={period} onPeriodChange={setPeriod}>
            <div className="mb-3 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#022d71]" />Expense</span>
            </div>
            <div className="h-[245px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND} stopOpacity={0.22} /><stop offset="100%" stopColor={BRAND} stopOpacity={0} /></linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUSH} stopOpacity={0.2} /><stop offset="100%" stopColor={BLUSH} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={BRAND} strokeWidth={2.5} fill="url(#revenueFill)" />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke={BLUSH} strokeWidth={2.5} fill="url(#expenseFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-4">
          <ChartCard title="Cash Flow" period={period} onPeriodChange={setPeriod}>
            <div className="mb-3 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />Cash In</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#174f91]" />Cash Out</span>
            </div>
            <div className="h-[245px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND} stopOpacity={0.22} /><stop offset="100%" stopColor={BRAND} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="cashIn" name="Cash In" stroke={BRAND} strokeWidth={2.5} fill="url(#cashFill)" />
                  <Area type="monotone" dataKey="cashOut" name="Cash Out" stroke={ROSE} strokeWidth={2.5} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-3">
          <ChartCard title="Expense Distribution" period={period} onPeriodChange={setPeriod}>
            <div className="flex min-h-[274px] flex-col items-center justify-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
              <div className="relative h-40 w-40 shrink-0">
                {expenseBreakdown.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={expenseBreakdown} dataKey="value" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="none">{expenseBreakdown.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-bold">${summary?.expenses.toLocaleString() || 0}</span><span className="text-[10px] text-muted-foreground">Total expense</span></div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-xs font-semibold text-muted-foreground">No expenses</div>
                )}
              </div>
              <div className="w-full space-y-3">
                {expenseBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-4 text-[11px]">
                    <span className="flex items-center gap-2 text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: item.color }} />{item.name}</span>
                    <span className="font-semibold tabular-nums">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between p-5">
          <div><h2 className="text-base font-semibold">Recent Transactions</h2><p className="mt-0.5 text-xs text-muted-foreground">Latest financial activity across your accounts</p></div>
          <button className="rounded-lg px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5">View all</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="border-y bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Account</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Status</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y">
              {transactions.length > 0 ? transactions.map((transaction) => {
                const revenue = /revenue|customer|pos|sale/i.test(transaction.type);
                return (
                  <tr key={`${transaction.id}-${transaction.date}`} className="transition hover:bg-muted/30">
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{new Date(transaction.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${revenue ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}`}>{transaction.type}</span></td>
                    <td className="px-4 py-3.5 font-medium">{transaction.description}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{transaction.account}</td>
                    <td className={`px-4 py-3.5 text-right font-bold tabular-nums ${revenue ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-500'}`}>${transaction.amount.toLocaleString()}</td>
                    <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${transaction.status === 'Posted' ? 'bg-primary/8 text-primary dark:text-[#022d71]' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>{transaction.status}</span></td>
                    <td className="pr-3"><button aria-label={`Options for ${transaction.description}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreVertical className="size-4" /></button></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No recent accounting transactions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
