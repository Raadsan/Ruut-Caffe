'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Edit3, Eye, Plus, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { vendorPaymentApi, type VendorPayment } from '@/lib/api/accounting/payables/vendorPaymentApi';
import { vendorBillApi, type VendorBill } from '@/lib/api/accounting/payables/vendorBillApi';
import { vendorApi } from '@/lib/api/accounting/payables/vendorApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { bankAccountApi } from '@/lib/api/accounting/banking/bankAccountApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Allocation = { bill_id: number; allocated_amount: number };
type Form = { vendor_id: string; bank_account_id: string; payment_method_id: string; payment_date: string; currency_id: string; exchange_rate: string; amount: string; reference: string; memo: string; allocations: Allocation[] };
const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Form => ({ vendor_id: '', bank_account_id: '', payment_method_id: '', payment_date: today(), currency_id: '', exchange_rate: '1', amount: '', reference: '', memo: '', allocations: [] });
const day = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown, code = '') => `${code ? `${code} ` : ''}${Number(value || 0).toFixed(2)}`;
const message = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

export default function VendorPaymentsPage() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [vendors, setVendors] = useState<Row[]>([]);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [methods, setMethods] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [selected, setSelected] = useState<VendorPayment | null>(null);
  const [open, setOpen] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete'; payment: VendorPayment } | null>(null);
  const [printTarget, setPrintTarget] = useState<VendorPayment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentRows, vendorRows, billRows, methodRows, bankRows, companyRows] = await Promise.all([vendorPaymentApi.getAll(), vendorApi.getAll(), vendorBillApi.getAll(), accountingPaymentMethodApi.getAll(), bankAccountApi.getAll(), companyApi.getAll()]);
      setPayments(paymentRows); setVendors(vendorRows); setBills(billRows); setMethods(methodRows); setBanks(bankRows); setCompanies(companyRows);
    } catch (error) { showToast(message(error), 'error'); } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const vendor = vendors.find((row) => row.id === Number(form.vendor_id));
  const selectedMethod = methods.find((row) => row.id === Number(form.payment_method_id));
  const methodUsesMultipleAccounts = selectedMethod?.allow_multiple_accounts === true;
  const availableBanks = banks.filter((row) => Number(row.company_id) === Number(vendor?.company_id) && row.is_active !== false && row.journal_id && row.gl_account_id);
  const shouldSelectBankAccount = methodUsesMultipleAccounts && availableBanks.length > 1;
  const openBills = bills.filter((bill) => bill.vendor_id === Number(form.vendor_id) && bill.state === 'posted' && Number(bill.currency_id) === Number(form.currency_id) && (Number(bill.amount_due) > 0 || form.allocations.some((row) => row.bill_id === bill.id)));
  const allocated = form.allocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
  const unallocated = Number(form.amount || 0) - allocated;
  const selectedBillTotal = form.allocations.reduce((sum, row) => sum + Number(openBills.find((bill) => bill.id === row.bill_id)?.amount_due || 0), 0);
  const balanceAfterPayment = Math.max(0, selectedBillTotal - allocated);
  const paymentStatus = allocated <= 0.005 ? 'Not Allocated' : balanceAfterPayment <= 0.005 ? 'Paid' : 'Partially Paid';
  const canPostPayment = !saving && Number(form.amount) > 0 && Boolean(form.payment_method_id) && (!shouldSelectBankAccount || Boolean(form.bank_account_id)) && allocated > 0.005 && allocated <= Number(form.amount) + 0.005;
  const filtered = payments.filter((payment) => {
    const needle = query.trim().toLowerCase();
    return (!needle || [payment.payment_number, payment.vendors?.name, payment.reference].some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (status === 'all' || payment.state === status) && (vendorFilter === 'all' || payment.vendor_id === Number(vendorFilter));
  });

  function createPayment() { setSelected(null); setReadonly(false); setForm(empty()); setOpen(true); }
  function selectVendor(value: string) {
    const next = vendors.find((row) => row.id === Number(value));
    const nextCompany = companies.find((row) => row.id === Number(next?.company_id));
    const currencyId = Number(next?.currency_id || nextCompany?.currency_id || 0);
    setForm((current) => ({ ...current, vendor_id: value, bank_account_id: '', currency_id: String(currencyId || ''), exchange_rate: '1', amount: '', allocations: [] }));
  }
  function selectBank(value: string) {
    const bank = banks.find((row) => row.id === Number(value));
    setForm((current) => ({ ...current, bank_account_id: value, currency_id: String(bank?.currency_id || current.currency_id), allocations: [] }));
  }
  function selectPaymentMethod(value: string) {
    setForm((current) => ({ ...current, payment_method_id: value, bank_account_id: '' }));
  }
  function edit(payment: VendorPayment, view = false) {
    setSelected(payment); setReadonly(view || payment.state !== 'draft');
    setForm({ vendor_id: String(payment.vendor_id), bank_account_id: String(payment.bank_account_id || ''), payment_method_id: String(payment.payment_method_id), payment_date: day(payment.payment_date), currency_id: String(payment.currency_id), exchange_rate: String(payment.exchange_rate || 1), amount: String(payment.amount), reference: String(payment.reference || ''), memo: String(payment.memo || ''), allocations: (payment.payment_allocations || []).map((row) => ({ bill_id: row.bill_id, allocated_amount: Number(row.allocated_amount) })) });
    setOpen(true);
  }
  function setAllocation(billId: number, value: string) {
    const outstanding = Number(openBills.find((bill) => bill.id === billId)?.amount_due || 0);
    const otherAllocated = form.allocations.filter((row) => row.bill_id !== billId).reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
    const nextAmount = Math.min(Math.max(0, Number(value) || 0), outstanding, Math.max(0, Number(form.amount || 0) - otherAllocated));
    setForm((current) => ({ ...current, allocations: nextAmount > 0
      ? current.allocations.some((row) => row.bill_id === billId)
        ? current.allocations.map((row) => row.bill_id === billId ? { ...row, allocated_amount: nextAmount } : row)
        : [...current.allocations, { bill_id: billId, allocated_amount: nextAmount }]
      : current.allocations.filter((row) => row.bill_id !== billId) }));
  }
  function toggleBill(bill: VendorBill, checked: boolean) {
    if (!checked) { setForm((current) => ({ ...current, allocations: current.allocations.filter((row) => row.bill_id !== bill.id) })); return; }
    const remaining = Math.max(0, Number(form.amount || 0) - allocated);
    const initial = Math.min(remaining, Number(bill.amount_due));
    setForm((current) => ({ ...current, allocations: [...current.allocations, { bill_id: bill.id, allocated_amount: Math.round(initial * 100) / 100 }] }));
  }
  function autoAllocate() {
    let remaining = Math.max(0, Number(form.amount || 0));
    const nextAllocations: Allocation[] = [];
    [...openBills.filter((bill) => form.allocations.some((allocation) => allocation.bill_id === bill.id))]
      .sort((a, b) => day(a.due_date).localeCompare(day(b.due_date)) || day(a.bill_date).localeCompare(day(b.bill_date)) || a.id - b.id)
      .forEach((bill) => {
        if (remaining <= 0.005) return;
        const amount = Math.min(remaining, Number(bill.amount_due));
        if (amount > 0) nextAllocations.push({ bill_id: bill.id, allocated_amount: Math.round(amount * 100) / 100 });
        remaining -= amount;
      });
    setForm((current) => ({ ...current, allocations: nextAllocations }));
  }
  async function save(event?: FormEvent, postAfterSave = false) {
    event?.preventDefault();
    if (postAfterSave && !canPostPayment) return;
    setSaving(true);
    const payload = { ...form, allocations: form.allocations.filter((row) => Number(row.allocated_amount) > 0.005), vendor_id: Number(form.vendor_id), bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : undefined, payment_method_id: Number(form.payment_method_id), payment_date: new Date(`${form.payment_date}T00:00:00.000Z`).toISOString(), currency_id: Number(form.currency_id), exchange_rate: Number(form.exchange_rate), amount: Number(form.amount) };
    try {
      const saved = selected ? await vendorPaymentApi.update(selected.id, payload) : await vendorPaymentApi.create(payload);
      if (postAfterSave) await vendorPaymentApi.post(saved.id);
      showToast(postAfterSave ? 'Vendor payment posted successfully' : `Draft vendor payment ${selected ? 'updated' : 'created'} successfully`, 'success'); setOpen(false); await load();
    } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); }
  }
  async function post(payment: VendorPayment) {
    setSaving(true); try { await vendorPaymentApi.post(payment.id); showToast('Vendor payment posted successfully', 'success'); setPendingAction(null); await load(); } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); }
  }
  async function remove(payment: VendorPayment) {
    setSaving(true); try { await vendorPaymentApi.remove(payment.id); showToast('Draft vendor payment deleted', 'success'); setPendingAction(null); await load(); } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); }
  }
  async function printPayment(payment: VendorPayment) {
    try { const fullPayment = await vendorPaymentApi.getById(payment.id); setPrintTarget(fullPayment); window.setTimeout(() => window.print(), 100); }
    catch (error) { showToast(message(error), 'error'); }
  }
  const columns: DashboardTableColumn<VendorPayment>[] = [
    { key: 'number', header: 'Payment', cell: (row) => <span className="font-bold text-primary">{row.payment_number}</span> },
    { key: 'date', header: 'Date', cell: (row) => day(row.payment_date) },
    { key: 'vendor', header: 'Vendor', cell: (row) => row.vendors?.name || '—' },
    { key: 'method', header: 'Method', cell: (row) => row.payment_methods?.name || '—' },
    { key: 'account', header: 'Payment Account', cell: (row) => row.bank_accounts?.account_name || row.payment_methods?.chart_of_accounts?.name || '—' },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="font-semibold">{money(row.amount, row.currencies?.code)}</span> },
    { key: 'allocated', header: 'Allocated', align: 'right', cell: (row) => money(Number(row.amount) - Number(row.unallocated_amount)) },
    { key: 'advance', header: 'Vendor Advance', align: 'right', cell: (row) => money(row.vendor_advances?.reduce((sum, advance) => sum + Number(advance.original_amount || 0), 0) || 0) },
    { key: 'state', header: 'Status', align: 'center', cell: (row) => <span className={`${dashboardStatusBadgeClass} ${row.state === 'posted' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>{row.state}</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1"><button title="View" onClick={() => edit(row, true)} className={actionBtnView}><Eye className="size-4" /></button>{row.state === 'draft' ? <><button title="Edit" onClick={() => edit(row)} className={actionBtnEdit}><Edit3 className="size-4" /></button><button title="Post" onClick={() => setPendingAction({ type: 'post', payment: row })} className={actionBtnView}><Send className="size-4" /></button><button title="Delete" onClick={() => setPendingAction({ type: 'delete', payment: row })} className={actionBtnDelete}><Trash2 className="size-4" /></button></> : <button title="Print" onClick={() => void printPayment(row)} className={actionBtnView}><Printer className="size-4" /></button>}</div> },
  ];

  return <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
    <div className={pageHeaderWrapperClass}><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Payables</p><h1 className={pageHeaderTitleClass}>Vendor Payments</h1><p className="mt-1 text-sm text-muted-foreground">Record payments and allocate them to posted vendor bills.</p></div>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search payments..." emptyText="No vendor payments found" minWidth="1250px" action={<button onClick={createPayment} className={btnCreatePage}><Plus className="size-4" /> New payment</button>} filters={<><select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All vendors</option>{vendors.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option></select><button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className="size-4" /></button></>} />
    <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{readonly ? 'Vendor payment' : selected ? 'Edit vendor payment' : 'Vendor payment'}</DialogTitle><DialogDescription>Enter the payment details and select the outstanding bills to pay.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-5">
      <fieldset disabled={readonly || saving} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Vendor" value={form.vendor_id} set={selectVendor} rows={vendors} />
        <Field label="Payment date" type="date" value={form.payment_date} set={(value) => setForm({ ...form, payment_date: value })} />
        <Field label="Payment amount" type="number" value={form.amount} set={(value) => setForm({ ...form, amount: value })} />
        <Select label="Payment method" value={form.payment_method_id} set={selectPaymentMethod} rows={methods.filter((row) => row.is_active !== false && ['outbound', 'both'].includes(String(row.payment_type)))} />
        {shouldSelectBankAccount && <Select label="Bank account" value={form.bank_account_id} set={selectBank} rows={availableBanks} labelKey="account_name" />}
        <Field label="Reference" value={form.reference} set={(value) => setForm({ ...form, reference: value })} optional />
      </fieldset>
      <div className="rounded-2xl border"><div className="flex flex-wrap items-center justify-between gap-4 border-b p-4"><div><h3 className="font-semibold">Outstanding Bills</h3><p className="text-xs text-muted-foreground">Select the bills covered by this payment.</p></div><button disabled={readonly || !form.amount || !openBills.length} type="button" onClick={autoAllocate} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Auto Allocate</button></div>
        <div className="max-h-72 overflow-auto">{!form.vendor_id ? <p className="p-6 text-center text-sm text-muted-foreground">Select a vendor first.</p> : openBills.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No outstanding posted bills found.</p> : <table className="w-full min-w-[880px] text-sm"><thead className="sticky top-0 bg-muted/70 text-xs uppercase"><tr><th className="p-3 text-center">Select</th><th className="p-3 text-left">Bill Number</th><th className="p-3 text-left">Bill Date</th><th className="p-3 text-left">Due Date</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Balance</th><th className="p-3 text-right">Allocate</th></tr></thead><tbody>{openBills.map((bill) => { const allocation = form.allocations.find((row) => row.bill_id === bill.id); const isSelected = Boolean(allocation); const paid = Number(bill.amount_paid ?? Math.max(0, Number(bill.amount_total) - Number(bill.amount_due))); return <tr key={bill.id} className="border-t"><td className="p-3 text-center"><input aria-label={`Select ${bill.bill_number}`} disabled={readonly} type="checkbox" checked={isSelected} onChange={(event) => toggleBill(bill, event.target.checked)} className="size-4 accent-primary" /></td><td className="p-3 font-semibold">{bill.bill_number}</td><td className="p-3">{day(bill.bill_date)}</td><td className="p-3">{day(bill.due_date)}</td><td className="p-3 text-right">{money(bill.amount_total)}</td><td className="p-3 text-right">{money(paid)}</td><td className="p-3 text-right font-semibold">{money(bill.amount_due)}</td><td className="p-3 text-right"><input aria-label={`Allocate to ${bill.bill_number}`} disabled={readonly || !isSelected} type="number" min="0" max={Number(bill.amount_due)} step=".01" value={allocation?.allocated_amount ?? ''} onChange={(event) => setAllocation(bill.id, event.target.value)} className="h-10 w-32 rounded-lg border px-3 text-right disabled:bg-muted" placeholder="0.00" /></td></tr>; })}</tbody></table>}</div>
      </div>
      <div className="ml-auto w-full rounded-2xl border p-4 sm:max-w-md"><h3 className="mb-3 font-semibold">Payment Summary</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Payment Amount</span><b>{money(form.amount)}</b></div><div className="flex justify-between"><span>Selected Bill Total</span><b>{money(selectedBillTotal)}</b></div><div className="flex justify-between"><span>Allocated</span><b>{money(allocated)}</b></div><div className={`flex justify-between ${Math.abs(unallocated) > 0.005 ? 'text-amber-700' : ''}`}><span>Unallocated</span><b>{money(unallocated)}</b></div><div className="flex justify-between border-t pt-2"><span>Balance After Payment</span><b>{money(balanceAfterPayment)}</b></div><div className="flex justify-between"><span>Status</span><b className={paymentStatus === 'Paid' ? 'text-emerald-700' : paymentStatus === 'Partially Paid' ? 'text-amber-700' : 'text-muted-foreground'}>{paymentStatus}</b></div></div></div>
      {Number(form.amount) > 0 && unallocated > 0.005 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The unallocated amount will be recorded as a Vendor Advance. It will not be applied to any unselected bill.</div>}
      <DialogFooter><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border px-5">{readonly ? 'Close' : 'Cancel'}</button>{!readonly && <><button disabled={saving || allocated <= 0.005 || allocated > Number(form.amount || 0) + 0.005} className="h-10 rounded-xl border px-5 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save Draft'}</button><button type="button" disabled={!canPostPayment} onClick={(event) => { if (event.currentTarget.form?.reportValidity()) void save(undefined, true); }} className="h-10 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-50">Post Payment</button></>}</DialogFooter>
    </form></DialogContent></Dialog>
    <AccountingConfirmDialog open={Boolean(pendingAction)} title={pendingAction?.type === 'delete' ? 'Delete Vendor Payment' : 'Post Vendor Payment'} description={pendingAction?.type === 'delete' ? 'Confirm removal of this draft vendor payment.' : 'Confirm the payment before updating the selected bill balances.'} confirmLabel={pendingAction?.type === 'delete' ? 'Delete Payment' : 'Post Payment'} destructive={pendingAction?.type === 'delete'} busy={saving} details={pendingAction && <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><b>{pendingAction.payment.payment_number}</b></div>} onCancel={() => setPendingAction(null)} onConfirm={() => pendingAction && void (pendingAction.type === 'delete' ? remove(pendingAction.payment) : post(pendingAction.payment))} />
    {printTarget && <PrintableVendorPayment payment={printTarget} bills={bills} />}
  </main>;
}

function PrintableVendorPayment({ payment, bills }: { payment: VendorPayment; bills: VendorBill[] }) {
  const currency = payment.currencies?.code || '';
  const allocated = Number(payment.amount) - Number(payment.unallocated_amount || 0);
  const advance = payment.vendor_advances?.reduce((sum, row) => sum + Number(row.original_amount || 0), 0) || 0;
  return <section id="printable-vendor-payment" className="hidden bg-white text-slate-950 print:block"><header className="flex items-start justify-between border-b-2 border-slate-900 pb-6"><div><h1 className="text-3xl font-bold text-[#6f0d18]">Ruut Caffe</h1><p className="mt-1 text-sm text-slate-500">Vendor payment voucher</p></div><div className="text-right"><h2 className="text-3xl font-semibold">PAYMENT</h2><p className="mt-2 font-bold">{payment.payment_number}</p></div></header><div className="grid grid-cols-2 gap-10 py-7 text-sm"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Paid to</p><p className="mt-2 text-base font-bold">{payment.vendors?.name || `Vendor #${payment.vendor_id}`}</p></div><dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-right"><dt className="text-slate-500">Payment date</dt><dd className="font-semibold">{day(payment.payment_date)}</dd><dt className="text-slate-500">Method</dt><dd className="font-semibold">{payment.payment_methods?.name || '—'}</dd><dt className="text-slate-500">Account</dt><dd className="font-semibold">{payment.bank_accounts?.account_name || '—'}</dd><dt className="text-slate-500">Reference</dt><dd className="font-semibold">{payment.reference || '—'}</dd></dl></div><div className="rounded-xl border border-slate-300 bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount paid</p><p className="mt-2 text-3xl font-bold">{money(payment.amount, currency)}</p></div><h3 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider">Bill allocation</h3><table className="w-full border-collapse text-sm"><thead><tr className="bg-[#6f0d18] text-white"><th className="p-3 text-left">Bill</th><th className="p-3 text-right">Amount applied</th></tr></thead><tbody>{(payment.payment_allocations || []).map((allocation, index) => <tr key={index} className="border-b"><td className="p-3 font-medium">{bills.find((bill) => bill.id === allocation.bill_id)?.bill_number || `Bill #${allocation.bill_id}`}</td><td className="p-3 text-right font-semibold">{money(allocation.allocated_amount, currency)}</td></tr>)}</tbody></table><div className="ml-auto mt-7 w-80 text-sm"><div className="flex justify-between py-1"><span>Payment</span><b>{money(payment.amount, currency)}</b></div><div className="flex justify-between py-1"><span>Allocated</span><b>{money(allocated, currency)}</b></div>{advance > 0 && <div className="flex justify-between py-1"><span>Vendor Advance</span><b>{money(advance, currency)}</b></div>}<div className="my-2 border-t border-slate-400" /><div className="flex justify-between py-2 text-base font-bold"><span>Remaining</span><span>{money(payment.unallocated_amount, currency)}</span></div></div></section>;
}
function Select({ label, value, set, rows, labelKey = 'name' }: { label: string; value: string; set: (value: string) => void; rows: Row[]; labelKey?: string }) { return <label className="text-xs font-semibold">{label} *<select required value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3"><option value="">Select {label.toLowerCase()}</option>{rows.map((row) => <option key={row.id} value={row.id}>{String(row[labelKey] || row.name || '')}</option>)}</select></label>; }
function Field({ label, value, set, type = 'text', optional, disabled, max }: { label: string; value: string; set: (value: string) => void; type?: string; optional?: boolean; disabled?: boolean; max?: number }) { return <label className="text-xs font-semibold">{label}{!optional && ' *'}<input disabled={disabled} required={!optional} type={type} min={type === 'number' ? '0.01' : undefined} max={type === 'number' ? max : undefined} step={type === 'number' ? '0.01' : undefined} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 disabled:bg-muted" /></label>; }
