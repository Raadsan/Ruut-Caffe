'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowDownToLine, ArrowUpFromLine, Edit3, Eye, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { journalEntryApi } from '@/lib/api/accounting/ledger/journalEntryApi';
import { bankAccountApi } from '@/lib/api/accounting/banking/bankAccountApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { chartOfAccountApi } from '@/lib/api/accounting/ledger/chartOfAccountApi';
import { accountingJournalApi } from '@/lib/api/accounting/ledger/journalApi';
import { fiscalPeriodApi } from '@/lib/api/accounting/ledger/fiscalPeriodApi';
import { fiscalYearApi } from '@/lib/api/accounting/ledger/fiscalYearApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Form = { type: 'receipt' | 'payment'; company_id: string; payment_method_id: string; bank_account_id: string; counter_account_id: string; entry_date: string; amount: string; reference: string; narration: string };
const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Form => ({ type: 'receipt', company_id: '', payment_method_id: '', bank_account_id: '', counter_account_id: '', entry_date: today(), amount: '', reference: '', narration: '' });
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown) => Number(value || 0).toFixed(2);
const message = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

export default function CashTransactionsPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [methods, setMethods] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [journals, setJournals] = useState<Row[]>([]);
  const [periods, setPeriods] = useState<Row[]>([]);
  const [years, setYears] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [selected, setSelected] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete'; entry: Row } | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entryRows, bankRows, companyRows, accountRows, journalRows, periodRows, yearRows, methodRows] = await Promise.all([journalEntryApi.getAll(), bankAccountApi.getAll(), companyApi.getAll(), chartOfAccountApi.getAll(), accountingJournalApi.getAll(), fiscalPeriodApi.getAll(), fiscalYearApi.getAll(), accountingPaymentMethodApi.getAll()]);
      const bankJournalIds = new Set(journalRows.filter((row) => ['bank', 'cash'].includes(String(row.journal_type))).map((row) => row.id));
      setEntries(entryRows.filter((row) => row.source_type === 'manual' && bankJournalIds.has(Number(row.journal_id))));
      setBanks(bankRows); setMethods(methodRows); setCompanies(companyRows); setAccounts(accountRows); setJournals(journalRows); setPeriods(periodRows); setYears(yearRows);
    } catch (error) { showToast(message(error), 'error'); } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const selectedMethod = methods.find((row) => row.id === Number(form.payment_method_id));
  const methodUsesMultipleAccounts = selectedMethod?.allow_multiple_accounts === true;
  const companyBanks = banks.filter((row) => Number(row.company_id) === Number(form.company_id) && row.is_active !== false && row.gl_account_id && row.journal_id);
  const shouldSelectBankAccount = methodUsesMultipleAccounts && companyBanks.length > 1;
  const companyAccounts = accounts.filter((row) => Number(row.company_id) === Number(form.company_id) && row.is_active !== false && row.allow_manual_entry !== false);
  const selectedBank = banks.find((row) => row.id === Number(form.bank_account_id)) || (methodUsesMultipleAccounts && companyBanks.length === 1 ? companyBanks[0] : undefined);
  const selectedPaymentAccountId = methodUsesMultipleAccounts ? selectedBank?.gl_account_id : selectedMethod?.gl_account_id || selectedBank?.gl_account_id;
  const amountFor = (entry: Row) => Math.max(...((entry.journal_items as Row[] | undefined) || []).map((line) => Number(line.debit || line.credit || 0)), 0);
  const typeFor = (entry: Row) => {
    const bank = banks.find((row) => Number(row.journal_id) === Number(entry.journal_id));
    const line = ((entry.journal_items as Row[] | undefined) || []).find((item) => item.account_id === bank?.gl_account_id);
    return Number(line?.debit || 0) > 0 ? 'receipt' : 'payment';
  };
  const filtered = useMemo(() => entries.filter((entry) => {
    const needle = query.trim().toLowerCase();
    return (!needle || [entry.entry_number, entry.reference, entry.narration].some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (typeFilter === 'all' || typeFor(entry) === typeFilter) && (statusFilter === 'all' || entry.state === statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [entries, query, statusFilter, typeFilter, banks]);

  function create() { setSelected(null); setReadonly(false); setForm(empty()); setOpen(true); }
  function edit(entry: Row, view = false) {
    const bank = banks.find((row) => Number(row.journal_id) === Number(entry.journal_id));
    const lines = (entry.journal_items as Row[] | undefined) || [];
    const bankLine = lines.find((line) => Number(line.account_id) === Number(bank?.gl_account_id));
    const other = lines.find((line) => Number(line.account_id) !== Number(bank?.gl_account_id));
    setSelected(entry); setReadonly(view || entry.state !== 'draft');
    setForm({ type: Number(bankLine?.debit || 0) > 0 ? 'receipt' : 'payment', company_id: String(entry.company_id), payment_method_id: String(bank?.payment_method_id || ''), bank_account_id: String(bank?.id || ''), counter_account_id: String(other?.account_id || ''), entry_date: dateValue(entry.entry_date), amount: String(Number(bankLine?.debit || bankLine?.credit || 0)), reference: String(entry.reference || ''), narration: String(entry.narration || '') });
    setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    const journal = methodUsesMultipleAccounts
      ? journals.find((row) => row.id === Number(selectedBank?.journal_id))
      : journals.find((row) => Number(row.company_id) === Number(form.company_id) && row.is_active !== false && ['cash', 'bank'].includes(String(row.journal_type)) && Number(row.default_debit_account_id) === Number(selectedPaymentAccountId))
        || journals.find((row) => Number(row.company_id) === Number(form.company_id) && row.is_active !== false && ['cash', 'bank'].includes(String(row.journal_type)));
    const period = periods.find((row) => row.state === 'open' && Number(years.find((year) => year.id === Number(row.fiscal_year_id))?.company_id) === Number(form.company_id) && dateValue(row.start_date) <= form.entry_date && dateValue(row.end_date) >= form.entry_date);
    const amount = Number(form.amount);
    const items = [
      { account_id: Number(selectedPaymentAccountId), label: form.narration || `Cash ${form.type}`, debit: form.type === 'receipt' ? amount : 0, credit: form.type === 'payment' ? amount : 0 },
      { account_id: Number(form.counter_account_id), label: form.narration || `Cash ${form.type}`, debit: form.type === 'payment' ? amount : 0, credit: form.type === 'receipt' ? amount : 0 },
    ];
    const payload = { company_id: Number(form.company_id), journal_id: Number(journal?.id), fiscal_period_id: Number(period?.id), entry_date: new Date(`${form.entry_date}T00:00:00.000Z`).toISOString(), reference: form.reference || null, narration: form.narration || `Cash ${form.type}`, items };
    try {
      if (!period) throw new Error('No open fiscal period covers the transaction date');
      if (selected) await journalEntryApi.update(selected.id, payload); else await journalEntryApi.create(payload);
      showToast(`Cash ${form.type} saved as draft`, 'success'); setOpen(false); await load();
    } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); }
  }
  async function post(entry: Row) { setSaving(true); try { await journalEntryApi.post(entry.id); showToast('Cash transaction posted', 'success'); setPendingAction(null); await load(); } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); } }
  async function remove(entry: Row) { setSaving(true); try { await journalEntryApi.remove(entry.id); showToast('Draft cash transaction deleted', 'success'); setPendingAction(null); await load(); } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); } }
  const columns: DashboardTableColumn<Row>[] = [
    { key: 'number', header: 'Transaction', cell: (row) => <span className="font-bold text-primary">{String(row.entry_number || `#${row.id}`)}</span> },
    { key: 'date', header: 'Date', cell: (row) => dateValue(row.entry_date) },
    { key: 'type', header: 'Type', cell: (row) => typeFor(row) === 'receipt' ? <span className="flex items-center gap-1 text-emerald-600"><ArrowDownToLine className="size-4" /> Receipt</span> : <span className="flex items-center gap-1 text-rose-600"><ArrowUpFromLine className="size-4" /> Payment</span> },
    { key: 'account', header: 'Cash / Bank Account', cell: (row) => String(banks.find((bank) => Number(bank.journal_id) === Number(row.journal_id))?.account_name || '—') },
    { key: 'reference', header: 'Reference', cell: (row) => String(row.reference || '—') },
    { key: 'description', header: 'Description', cell: (row) => String(row.narration || '—') },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="font-semibold">{money(amountFor(row))}</span> },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <span className={`${dashboardStatusBadgeClass} ${row.state === 'posted' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>{String(row.state)}</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1"><button onClick={() => edit(row, true)} className={actionBtnView}><Eye className="size-4" /></button>{row.state === 'draft' && <><button onClick={() => edit(row)} className={actionBtnEdit}><Edit3 className="size-4" /></button><button onClick={() => setPendingAction({ type: 'post', entry: row })} className={actionBtnView}><Send className="size-4" /></button><button onClick={() => setPendingAction({ type: 'delete', entry: row })} className={actionBtnDelete}><Trash2 className="size-4" /></button></>}</div> },
  ];

  return <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
    <div className={pageHeaderWrapperClass}><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Banking</p><h1 className={pageHeaderTitleClass}>Cash Transactions</h1><p className="mt-1 text-sm text-muted-foreground">Record cash and bank receipts or payments with balanced ledger entries.</p></div>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search cash transactions..." emptyText="No cash transactions found" minWidth="1200px" action={<button onClick={create} className={btnCreatePage}><Plus className="size-4" /> New transaction</button>} filters={<><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All types</option><option value="receipt">Receipts</option><option value="payment">Payments</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option></select><button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />
    <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{readonly ? 'Cash transaction' : selected ? 'Edit cash transaction' : 'New cash transaction'}</DialogTitle><DialogDescription>Every transaction creates a balanced two-line journal entry.</DialogDescription></DialogHeader><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><fieldset disabled={readonly || saving} className="contents">
      <label className="text-xs font-semibold">Transaction type *<select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Form['type'] })} className="mt-1.5 h-10 w-full rounded-xl border px-3"><option value="receipt">Cash receipt</option><option value="payment">Cash payment</option></select></label>
      <Select label="Company" value={form.company_id} set={(value) => setForm({ ...form, company_id: value, payment_method_id: '', bank_account_id: '', counter_account_id: '' })} rows={companies} />
      <Select label="Payment method" value={form.payment_method_id} set={(value) => setForm({ ...form, payment_method_id: value, bank_account_id: '', counter_account_id: '' })} rows={methods.filter((row) => row.is_active !== false && ['both', form.type === 'receipt' ? 'inbound' : 'outbound'].includes(String(row.payment_type)))} />
      {shouldSelectBankAccount && <Select label="Bank account" value={form.bank_account_id} set={(value) => setForm({ ...form, bank_account_id: value })} rows={companyBanks} labelKey="account_name" />}
      <Select label="Counter account" value={form.counter_account_id} set={(value) => setForm({ ...form, counter_account_id: value })} rows={companyAccounts.filter((row) => row.id !== Number(selectedPaymentAccountId))} account />
      <Field label="Transaction date" type="date" value={form.entry_date} set={(value) => setForm({ ...form, entry_date: value })} />
      <Field label="Amount" type="number" value={form.amount} set={(value) => setForm({ ...form, amount: value })} />
      <Field label="Reference" value={form.reference} set={(value) => setForm({ ...form, reference: value })} optional />
      <Field label="Description" value={form.narration} set={(value) => setForm({ ...form, narration: value })} />
      </fieldset><DialogFooter className="sm:col-span-2"><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border px-5">{readonly ? 'Close' : 'Cancel'}</button>{!readonly && <button disabled={saving} className="h-10 rounded-xl bg-primary px-5 font-semibold text-white">{saving ? 'Saving...' : 'Save draft'}</button>}</DialogFooter>
    </form></DialogContent></Dialog>
    <AccountingConfirmDialog open={Boolean(pendingAction)} title={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Cash Transaction`} description={pendingAction?.type === 'delete' ? 'Confirm removal of this draft cash transaction.' : 'Confirm this cash transaction before posting it to the ledger.'} confirmLabel={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Transaction`} destructive={pendingAction?.type === 'delete'} busy={saving} details={pendingAction && <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><b>{String(pendingAction.entry.reference || pendingAction.entry.entry_number || '—')}</b></div>} onCancel={() => setPendingAction(null)} onConfirm={() => pendingAction && void (pendingAction.type === 'delete' ? remove(pendingAction.entry) : post(pendingAction.entry))} />
  </main>;
}
function Field({ label, value, set, type = 'text', optional }: { label: string; value: string; set: (value: string) => void; type?: string; optional?: boolean }) { return <label className="text-xs font-semibold">{label}{!optional && ' *'}<input required={!optional} type={type} min={type === 'number' ? '.01' : undefined} step={type === 'number' ? '.01' : undefined} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border px-3" /></label>; }
function Select({ label, value, set, rows, labelKey = 'name', account }: { label: string; value: string; set: (value: string) => void; rows: Row[]; labelKey?: string; account?: boolean }) { return <label className="text-xs font-semibold">{label} *<select required value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border px-3"><option value="">Select {label.toLowerCase()}</option>{rows.map((row) => <option key={row.id} value={row.id}>{account ? `${String(row.code)} — ${String(row.name)}` : String(row[labelKey] || row.name || '')}</option>)}</select></label>; }
