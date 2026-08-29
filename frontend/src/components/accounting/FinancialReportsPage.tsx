'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Download, FileBarChart, Printer, RefreshCw } from 'lucide-react';
import { accountingReportApi } from '@/lib/api/accounting/accountingReportApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { chartOfAccountApi } from '@/lib/api/accounting/ledger/chartOfAccountApi';
import { fiscalPeriodApi } from '@/lib/api/accounting/ledger/fiscalPeriodApi';
import { fiscalYearApi } from '@/lib/api/accounting/ledger/fiscalYearApi';
import { accountingJournalApi } from '@/lib/api/accounting/ledger/journalApi';
import { useToast } from '@/components/ui/toast';
import { pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';

export type FinancialReportKind = 'general-ledger' | 'trial-balance' | 'profit-and-loss' | 'balance-sheet' | 'cash-flow' | 'journal-report';
type Row = { id?: number; [key: string]: unknown };
const titles: Record<FinancialReportKind, string> = {
  'general-ledger': 'General Ledger', 'trial-balance': 'Trial Balance', 'profit-and-loss': 'Profit & Loss',
  'balance-sheet': 'Balance Sheet', 'cash-flow': 'Cash Flow', 'journal-report': 'Journal Report',
};
const descriptions: Record<FinancialReportKind, string> = {
  'general-ledger': 'Review every posted debit and credit by ledger account.',
  'trial-balance': 'Confirm that posted debit and credit totals remain balanced.',
  'profit-and-loss': 'Measure income, expenses, and net profit for the selected period.',
  'balance-sheet': 'Review assets, liabilities, and equity as of a selected date.',
  'cash-flow': 'Track cash and bank inflows, outflows, and closing balances.',
  'journal-report': 'Audit posted journal entries and their balanced accounting lines.',
};
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown) => Number(value || 0).toFixed(2);
const message = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Unable to load report';

export default function FinancialReportsPage({ kind }: { kind: FinancialReportKind }) {
  const { showToast } = useToast();
  const [companies, setCompanies] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [periods, setPeriods] = useState<Row[]>([]);
  const [years, setYears] = useState<Row[]>([]);
  const [journals, setJournals] = useState<Row[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [periodId, setPeriodId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [journalId, setJournalId] = useState('');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([companyApi.getAll(), chartOfAccountApi.getAll(), fiscalPeriodApi.getAll(), fiscalYearApi.getAll(), accountingJournalApi.getAll()])
      .then(([companyRows, accountRows, periodRows, yearRows, journalRows]) => {
        setCompanies(companyRows); setAccounts(accountRows); setPeriods(periodRows); setYears(yearRows); setJournals(journalRows);
        if (companyRows.length === 1) setCompanyId(String(companyRows[0].id));
      }).catch((error) => showToast(message(error), 'error'));
  }, [showToast]);

  const load = useCallback(async () => {
    if (!companyId) { setData(null); return; }
    setLoading(true);
    const filters = { companyId: Number(companyId), startDate: periodId ? undefined : startDate, endDate: periodId ? undefined : endDate, periodId: periodId ? Number(periodId) : undefined };
    try {
      const result = kind === 'general-ledger' ? await accountingReportApi.getGeneralLedger({ ...filters, accountId: accountId ? Number(accountId) : undefined })
        : kind === 'trial-balance' ? await accountingReportApi.getTrialBalance(filters)
        : kind === 'profit-and-loss' ? await accountingReportApi.getProfitAndLoss(filters)
        : kind === 'balance-sheet' ? await accountingReportApi.getBalanceSheet(Number(companyId), endDate)
        : kind === 'cash-flow' ? await accountingReportApi.getCashFlow(filters)
        : await accountingReportApi.getJournalReport({ ...filters, journalId: journalId ? Number(journalId) : undefined });
      setData(result);
    } catch (error) { setData(null); showToast(message(error), 'error'); } finally { setLoading(false); }
  }, [accountId, companyId, endDate, journalId, kind, periodId, startDate, showToast]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const companyPeriods = periods.filter((period) => Number(years.find((year) => year.id === Number(period.fiscal_year_id))?.company_id) === Number(companyId));
  const companyAccounts = accounts.filter((row) => Number(row.company_id) === Number(companyId));
  const companyJournals = journals.filter((row) => Number(row.company_id) === Number(companyId));
  const exportRows = useMemo(() => flattenForExport(kind, data), [data, kind]);
  function exportCsv() {
    if (!exportRows.length) return;
    const keys = Object.keys(exportRows[0]);
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [keys.map(escape).join(','), ...exportRows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${kind}-${today()}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
    <div className={`${pageHeaderWrapperClass} print:border-0 print:shadow-none`}><div className="flex items-center gap-2 text-primary"><FileBarChart className="size-4" /><span className="text-xs font-bold uppercase tracking-[.2em]">Financial Reports</span></div><h1 className={pageHeaderTitleClass}>{titles[kind]}</h1><p className="mt-1 text-sm text-muted-foreground">{descriptions[kind]}</p></div>
    <section className="rounded-2xl border bg-card p-4 shadow-sm print:hidden"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <Select label="Company" value={companyId} set={(value) => { setCompanyId(value); setPeriodId(''); setAccountId(''); setJournalId(''); }} rows={companies} />
      {kind !== 'balance-sheet' && <Select label="Fiscal period" value={periodId} set={setPeriodId} rows={companyPeriods} optional />}
      {kind !== 'balance-sheet' && !periodId && <Field label="From" value={startDate} set={setStartDate} />}
      {!periodId && <Field label={kind === 'balance-sheet' ? 'As of date' : 'To'} value={endDate} set={setEndDate} />}
      {kind === 'general-ledger' && <Select label="Account" value={accountId} set={setAccountId} rows={companyAccounts} account optional />}
      {kind === 'journal-report' && <Select label="Journal" value={journalId} set={setJournalId} rows={companyJournals} account optional />}
      <div className="flex items-end gap-2"><button onClick={() => void load()} disabled={!companyId || loading} className="flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Run</button><button title="Export CSV" onClick={exportCsv} disabled={!exportRows.length} className="flex size-10 items-center justify-center rounded-xl border disabled:opacity-40"><Download className="size-4" /></button><button title="Print" onClick={() => window.print()} disabled={!data} className="flex size-10 items-center justify-center rounded-xl border disabled:opacity-40"><Printer className="size-4" /></button></div>
    </div></section>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm print:border-0 print:shadow-none">
      <div className="border-b p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{companies.find((row) => row.id === Number(companyId))?.name ? String(companies.find((row) => row.id === Number(companyId))?.name) : 'Select a company'}</h2><p className="text-xs text-muted-foreground">{periodId ? String(companyPeriods.find((row) => row.id === Number(periodId))?.name || '') : `${startDate} to ${endDate}`}</p></div><p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p></div></div>
      {!companyId ? <Empty text="Select a company to generate this report." /> : loading ? <Empty text="Preparing report…" /> : !data ? <Empty text="No report data available." /> : <ReportBody kind={kind} data={data} />}
    </section>
  </main>;
}

function ReportBody({ kind, data }: { kind: FinancialReportKind; data: unknown }) {
  if (kind === 'general-ledger') {
    const rows = data as Row[];
    const mapped = rows.reduce<{ balance: number; rows: unknown[][] }>((result, row) => {
      const balance = result.balance + Number(row.debit || 0) - Number(row.credit || 0);
      const entry = row.journal_entries as Row; const account = row.chart_of_accounts as Row;
      return { balance, rows: [...result.rows, [dateValue(entry?.entry_date), entry?.entry_number, `${account?.code} — ${account?.name}`, entry?.reference, row.label || entry?.narration, money(row.debit), money(row.credit), money(balance)]] };
    }, { balance: 0, rows: [] });
    return <ReportTable headers={['Date', 'Entry', 'Account', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']} rows={mapped.rows} footer={['', '', '', '', 'Totals', money(rows.reduce((sum, row) => sum + Number(row.debit), 0)), money(rows.reduce((sum, row) => sum + Number(row.credit), 0)), money(mapped.balance)]} />;
  }
  if (kind === 'trial-balance') {
    const rows = data as Row[]; const debit = rows.reduce((sum, row) => sum + Number(row.total_debit), 0); const credit = rows.reduce((sum, row) => sum + Number(row.total_credit), 0);
    return <ReportTable headers={['Code', 'Account', 'Debit', 'Credit', 'Balance']} rows={rows.map((row) => [row.account_code, row.account_name, money(row.total_debit), money(row.total_credit), money(row.balance)])} footer={['', 'Totals', money(debit), money(credit), money(debit - credit)]} />;
  }
  if (kind === 'profit-and-loss') {
    const report = data as { income: { total: number; accounts: Row[] }; expense: { total: number; accounts: Row[] }; net_income: number };
    return <div className="p-5"><Statement title="Income" rows={report.income.accounts} total={report.income.total} /><Statement title="Expenses" rows={report.expense.accounts} total={report.expense.total} /><div className={`mt-5 flex justify-between rounded-xl p-4 text-lg font-bold ${report.net_income >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}><span>Net Profit / (Loss)</span><span>{money(report.net_income)}</span></div></div>;
  }
  if (kind === 'balance-sheet') {
    const report = data as { assets: { total: number; accounts: Row[] }; liabilities: { total: number; accounts: Row[] }; equity: { total: number; accounts: Row[] } };
    return <div className="grid gap-5 p-5 lg:grid-cols-2"><Statement title="Assets" rows={report.assets.accounts} total={report.assets.total} /><div><Statement title="Liabilities" rows={report.liabilities.accounts} total={report.liabilities.total} /><Statement title="Equity" rows={report.equity.accounts} total={report.equity.total} /><div className="mt-4 flex justify-between rounded-xl bg-muted p-4 font-bold"><span>Liabilities + Equity</span><span>{money(report.liabilities.total + report.equity.total)}</span></div></div></div>;
  }
  if (kind === 'cash-flow') {
    const report = data as { accounts: Row[]; opening_balance: number; inflows: number; outflows: number; net_change: number; closing_balance: number };
    return <><div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Opening" value={report.opening_balance} /><Metric label="Inflows" value={report.inflows} positive /><Metric label="Outflows" value={report.outflows} negative /><Metric label="Net change" value={report.net_change} /><Metric label="Closing" value={report.closing_balance} /></div><ReportTable headers={['Account', 'Number', 'Currency', 'Opening', 'Inflows', 'Outflows', 'Net Change', 'Closing']} rows={report.accounts.map((row) => [row.account_name, row.account_number, row.currency, money(row.opening_balance), money(row.inflows), money(row.outflows), money(row.net_change), money(row.closing_balance)])} /></>;
  }
  const entries = data as Row[];
  return <div>{entries.map((entry) => <div key={String(entry.id)} className="border-b p-4"><div className="mb-3 flex flex-wrap justify-between gap-2"><div><span className="font-bold text-primary">{String(entry.entry_number || `#${entry.id}`)}</span><span className="ml-3 text-xs text-muted-foreground">{dateValue(entry.entry_date)} · {String((entry.journals as Row)?.name || '')}</span></div><span className="text-xs">{String(entry.reference || entry.narration || '')}</span></div><ReportTable compact headers={['Account', 'Label', 'Debit', 'Credit']} rows={((entry.journal_items as Row[]) || []).map((line) => [`${String((line.chart_of_accounts as Row)?.code || '')} — ${String((line.chart_of_accounts as Row)?.name || '')}`, line.label, money(line.debit), money(line.credit)])} footer={['', 'Totals', money(entry.total_debit), money(entry.total_credit)]} /></div>)}</div>;
}
type ReportTableRow = { id: number; values: unknown[] };
function ReportTable({ headers, rows, footer, compact }: { headers: string[]; rows: unknown[][]; footer?: unknown[]; compact?: boolean }) {
  const [search, setSearch] = useState('');
  const tableRows = useMemo<ReportTableRow[]>(() => rows.map((values, index) => ({ id: index + 1, values })), [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? tableRows.filter((row) => row.values.some((value) => String(value ?? '').toLowerCase().includes(query))) : tableRows;
  }, [search, tableRows]);
  const columns = useMemo<DashboardTableColumn<ReportTableRow>[]>(() => headers.map((header, index) => ({
    key: `${header}-${index}`,
    header,
    align: index >= headers.length - 3 ? 'right' : 'left',
    className: compact ? 'text-[11px]' : undefined,
    cell: (row) => String(row.values[index] ?? '—'),
  })), [compact, headers]);
  const footerContent = footer ? <tfoot className="border-t-2 bg-muted/30 font-bold"><tr>{footer.map((value, index) => <td key={index} className={`px-4 py-3 ${index >= footer.length - 3 ? 'text-right' : ''}`}>{String(value ?? '')}</td>)}</tr></tfoot> : undefined;
  return <DashboardDataTable rows={filteredRows} columns={columns} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search report..." emptyText="No posted activity for this selection." minWidth="720px" pageSizes={[10, 25, 50]} footer={footerContent} />;
}
function Statement({ title, rows, total }: { title: string; rows: Row[]; total: number }) { return <section className="mb-5"><h3 className="border-b pb-2 font-bold">{title}</h3>{rows.map((row) => <div key={String(row.account_id)} className="flex justify-between border-b border-dashed py-2 text-sm"><span>{String(row.account_code)} — {String(row.account_name)}</span><span className="tabular-nums">{money(row.balance)}</span></div>)}<div className="mt-2 flex justify-between rounded-lg bg-muted px-3 py-2 font-bold"><span>Total {title}</span><span>{money(total)}</span></div></section>; }
function Metric({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) { return <div className="rounded-xl border p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-bold ${positive ? 'text-emerald-600' : negative ? 'text-rose-600' : ''}`}>{money(value)}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="p-16 text-center text-sm text-muted-foreground">{text}</div>; }
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) { return <label className="text-xs font-semibold">{label}<input type="date" value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3" /></label>; }
function Select({ label, value, set, rows, optional, account }: { label: string; value: string; set: (value: string) => void; rows: Row[]; optional?: boolean; account?: boolean }) { return <label className="text-xs font-semibold">{label}{!optional && ' *'}<select required={!optional} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3"><option value="">{optional ? `All ${label.toLowerCase()}s` : `Select ${label.toLowerCase()}`}</option>{rows.map((row) => <option key={row.id} value={row.id}>{account ? `${String(row.code || '')} — ${String(row.name || '')}` : String(row.name || '')}</option>)}</select></label>; }
function flattenForExport(kind: FinancialReportKind, data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (kind === 'general-ledger') return (data as Row[]).map((row) => ({ date: dateValue((row.journal_entries as Row)?.entry_date), entry: (row.journal_entries as Row)?.entry_number, account: `${String((row.chart_of_accounts as Row)?.code || '')} ${String((row.chart_of_accounts as Row)?.name || '')}`, description: row.label, debit: row.debit, credit: row.credit }));
    if (kind === 'journal-report') return (data as Row[]).flatMap((entry) => ((entry.journal_items as Row[]) || []).map((line) => ({ date: dateValue(entry.entry_date), entry: entry.entry_number, journal: (entry.journals as Row)?.name, account: (line.chart_of_accounts as Row)?.code, label: line.label, debit: line.debit, credit: line.credit })));
    return data as Record<string, unknown>[];
  }
  const report = data as Record<string, unknown>;
  if (kind === 'profit-and-loss') return ['income', 'expense'].flatMap((group) => (((report[group] as { accounts: Row[] })?.accounts) || []).map((row) => ({ group, code: row.account_code, account: row.account_name, balance: row.balance })));
  if (kind === 'balance-sheet') return ['assets', 'liabilities', 'equity'].flatMap((group) => (((report[group] as { accounts: Row[] })?.accounts) || []).map((row) => ({ group, code: row.account_code, account: row.account_name, balance: row.balance })));
  if (kind === 'cash-flow') return (report.accounts as Record<string, unknown>[]) || [];
  return [];
}
