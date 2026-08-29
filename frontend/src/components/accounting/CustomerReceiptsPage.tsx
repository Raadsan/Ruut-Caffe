'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Edit3, Eye, Plus, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { customerReceiptApi, type CustomerReceipt } from '@/lib/api/accounting/receivables/customerReceiptApi';
import type { CustomerInvoice } from '@/lib/api/accounting/receivables/customerInvoiceApi';
import { accountingCustomerApi } from '@/lib/api/accounting/receivables/customerApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Allocation = { invoice_id: number; allocated_amount: number };
type Form = {
  customer_id: string; journal_id: string; cash_bank_account_id: string; payment_method_id: string; receipt_date: string;
  currency_id: string; exchange_rate: string; amount: string; reference: string; memo: string;
  allocations: Allocation[];
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): Form => ({ customer_id: '', journal_id: '', cash_bank_account_id: '', payment_method_id: '', receipt_date: today(), currency_id: '', exchange_rate: '1', amount: '', reference: '', memo: '', allocations: [] });
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown, code = '') => `${code ? `${code} ` : ''}${Number(value || 0).toFixed(2)}`;
const message = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

function allocateSelectedInvoices(invoices: CustomerInvoice[], selectedIds: number[], receiptAmount: number): Allocation[] {
  let remaining = Math.max(0, receiptAmount);
  return invoices.filter((invoice) => selectedIds.includes(invoice.id))
    .sort((a, b) => dateValue(a.invoice_date).localeCompare(dateValue(b.invoice_date)) || a.id - b.id)
    .flatMap((invoice) => {
      if (remaining <= 0) return [];
      const applied = Math.min(remaining, Number(invoice.amount_due || 0));
      remaining = Math.round((remaining - applied) * 100) / 100;
      return applied > 0 ? [{ invoice_id: invoice.id, allocated_amount: Math.round(applied * 100) / 100 }] : [];
    });
}

export default function CustomerReceiptsPage() {
  const { showToast } = useToast();
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [methods, setMethods] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<CustomerReceipt | null>(null);
  const [postTarget, setPostTarget] = useState<CustomerReceipt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerReceipt | null>(null);
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [printTarget, setPrintTarget] = useState<CustomerReceipt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [receiptRows, customerRows, methodRows] = await Promise.all([
        customerReceiptApi.getAll(), accountingCustomerApi.getAll(), accountingPaymentMethodApi.getAll(),
      ]);
      setReceipts(receiptRows); setCustomers(customerRows); setMethods(methodRows);
    } catch (error) { showToast(message(error), 'error'); } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const openInvoices = invoices.filter((invoice) => {
    const alreadyAllocated = form.allocations.some((row) => row.invoice_id === invoice.id);
    return invoice.customer_id === Number(form.customer_id) && invoice.state === 'posted' &&
      (alreadyAllocated || ['not_paid', 'partial'].includes(invoice.payment_state)) &&
      true;
  });
  const allocated = form.allocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
  const unallocated = Number(form.amount || 0) - allocated;
  const selectedOutstandingBefore = form.allocations.reduce((sum, allocation) => {
    const invoice = invoices.find((row) => row.id === allocation.invoice_id);
    const currentOutstanding = Number(invoice?.amount_due || 0);
    return sum + currentOutstanding + (viewOnly && selected?.state === 'posted' ? Number(allocation.allocated_amount || 0) : 0);
  }, 0);
  const outstandingAfterPayment = form.allocations.reduce((sum, allocation) => {
    const invoice = invoices.find((row) => row.id === allocation.invoice_id);
    const currentOutstanding = Number(invoice?.amount_due || 0);
    const outstandingBefore = currentOutstanding + (viewOnly && selected?.state === 'posted' ? Number(allocation.allocated_amount || 0) : 0);
    return sum + Math.max(0, outstandingBefore - Number(allocation.allocated_amount || 0));
  }, 0);
  const allocationInvalid = !viewOnly && (allocated > Number(form.amount || 0) + 0.005 || form.allocations.some((allocation) => {
    const invoice = invoices.find((row) => row.id === allocation.invoice_id);
    return !invoice || Number(allocation.allocated_amount) > Number(invoice.amount_due) + 0.005;
  }));
  const filtered = receipts.filter((receipt) => {
    const needle = query.toLowerCase().trim();
    const receiptDate = dateValue(receipt.receipt_date);
    return (!needle || [receipt.receipt_number, receipt.customers?.name, receipt.reference].some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (status === 'all' || receipt.state === status) &&
      (customerFilter === 'all' || receipt.customer_id === Number(customerFilter)) &&
      (methodFilter === 'all' || receipt.payment_method_id === Number(methodFilter)) &&
      (!dateFrom || receiptDate >= dateFrom) &&
      (!dateTo || receiptDate <= dateTo);
  });

  function newReceipt() {
    setSelected(null); setViewOnly(false); setInvoices([]); setForm(emptyForm()); setOpen(true);
  }
  async function edit(receipt: CustomerReceipt, readOnly = false) {
    setSelected(receipt); setViewOnly(readOnly || receipt.state !== 'draft');
    const allocationInvoices = (receipt.receipt_allocations || []).flatMap((row) => row.customer_invoices ? [{ ...row.customer_invoices, customer_id: receipt.customer_id, currency_id: receipt.currency_id, state: 'posted', paid_amount: Number(row.customer_invoices.amount_total) - Number(row.customer_invoices.amount_due), currencies: receipt.currencies }] as unknown as CustomerInvoice[] : []);
    try {
      const outstanding = await customerReceiptApi.outstandingInvoices(receipt.customer_id);
      setInvoices([...new Map([...outstanding, ...allocationInvoices].map((row) => [row.id, row])).values()]);
    } catch { setInvoices(allocationInvoices); }
    setForm({
      customer_id: String(receipt.customer_id), journal_id: '', cash_bank_account_id: '', payment_method_id: String(receipt.payment_method_id),
      receipt_date: dateValue(receipt.receipt_date), currency_id: String(receipt.currency_id), exchange_rate: String(receipt.exchange_rate || 1),
      amount: String(receipt.amount), reference: String(receipt.reference || ''), memo: String(receipt.memo || ''),
      allocations: (receipt.receipt_allocations || []).map((row) => ({ invoice_id: row.invoice_id, allocated_amount: Number(row.allocated_amount) })),
    });
    setOpen(true);
  }
  async function selectCustomer(value: string) {
    setInvoices([]);
    setForm((current) => ({ ...current, customer_id: value, journal_id: '', cash_bank_account_id: '', payment_method_id: '', currency_id: '', exchange_rate: '1', allocations: [] }));
    if (!value) return;
    try {
      const rows = await customerReceiptApi.outstandingInvoices(Number(value));
      setInvoices(rows);
      setForm((current) => ({ ...current, allocations: [] }));
    }
    catch (error) { showToast(message(error), 'error'); }
  }
  function selectPaymentMethod(value: string) {
    setForm((current) => ({ ...current, payment_method_id: value, journal_id: '', cash_bank_account_id: '' }));
  }
  function changeReceiptAmount(value: string) {
    setForm((current) => ({ ...current, amount: value }));
  }
  function autoAllocate() {
    setForm((current) => ({ ...current, allocations: allocateSelectedInvoices(openInvoices, current.allocations.map((row) => row.invoice_id), Number(current.amount || 0)) }));
  }
  function toggleInvoice(invoice: CustomerInvoice, checked: boolean) {
    if (!checked) { setForm((current) => ({ ...current, allocations: current.allocations.filter((row) => row.invoice_id !== invoice.id) })); return; }
    const remaining = Math.max(0, Number(form.amount || 0) - allocated);
    setForm((current) => ({ ...current, allocations: [...current.allocations, { invoice_id: invoice.id, allocated_amount: Math.min(remaining, Number(invoice.amount_due || 0)) }] }));
  }
  function setAllocation(invoice: CustomerInvoice, value: string) {
    const otherAllocated = form.allocations.filter((row) => row.invoice_id !== invoice.id).reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
    const amount = Math.min(Math.max(0, Number(value) || 0), Number(invoice.amount_due || 0), Math.max(0, Number(form.amount || 0) - otherAllocated));
    setForm((current) => ({ ...current, allocations: current.allocations.map((row) => row.invoice_id === invoice.id ? { ...row, allocated_amount: amount } : row) }));
  }
  async function save(event?: FormEvent, postAfterSave = false) {
    event?.preventDefault();
    if (allocationInvalid) { showToast('The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { customer_id: Number(form.customer_id), payment_method_id: Number(form.payment_method_id), amount: Number(form.amount), receipt_date: new Date(`${form.receipt_date}T00:00:00.000Z`).toISOString(), reference: form.reference, memo: form.memo, allocations: form.allocations.filter((row) => Number(row.allocated_amount) > 0.005) };
      const saved = selected ? await customerReceiptApi.update(selected.id, payload) : await customerReceiptApi.create(payload);
      if (postAfterSave) await customerReceiptApi.post(saved.id);
      showToast(postAfterSave ? 'Customer receipt posted successfully' : selected ? 'Draft receipt updated successfully' : 'Draft receipt created successfully', 'success');
      setOpen(false); await load();
    } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); }
  }
  async function post(receipt: CustomerReceipt) {
    setSaving(true);
    try { await customerReceiptApi.post(receipt.id); showToast('Customer receipt posted successfully', 'success'); setPostTarget(null); await load(); }
    catch (error) { showToast(message(error), 'error'); }
    finally { setSaving(false); }
  }
  async function remove(receipt: CustomerReceipt) {
    setSaving(true); try { await customerReceiptApi.remove(receipt.id); showToast('Draft receipt deleted', 'success'); setDeleteTarget(null); await load(); }
    catch (error) { showToast(message(error), 'error'); }
    finally { setSaving(false); }
  }
  async function printReceipt(receipt: CustomerReceipt) {
    try {
      const fullReceipt = await customerReceiptApi.getById(receipt.id);
      setPrintTarget(fullReceipt);
      window.setTimeout(() => window.print(), 100);
    } catch (error) { showToast(message(error), 'error'); }
  }
  const columns: DashboardTableColumn<CustomerReceipt>[] = [
    { key: 'number', header: 'Receipt', cell: (row) => <span className="font-bold text-primary">{row.receipt_number || `#${row.id}`}</span> },
    { key: 'date', header: 'Date', cell: (row) => dateValue(row.receipt_date) },
    { key: 'customer', header: 'Customer', cell: (row) => row.customers?.name || '—' },
    { key: 'method', header: 'Method', cell: (row) => row.payment_methods?.name || '—' },
    { key: 'journal', header: 'Journal', cell: (row) => row.journals?.name || '—' },
    { key: 'account', header: 'Cash/Bank Account', cell: (row) => row.journal_entries?.journal_items?.[0]?.chart_of_accounts ? `${row.journal_entries.journal_items[0].chart_of_accounts.code} — ${row.journal_entries.journal_items[0].chart_of_accounts.name}` : '—' },
    { key: 'currency', header: 'Currency', cell: (row) => row.currencies?.code || '—' },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="font-semibold">{money(row.amount)}</span> },
    { key: 'allocated', header: 'Allocated', align: 'right', cell: (row) => money(Number(row.amount) - Number(row.unallocated_amount)) },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <span className={`${dashboardStatusBadgeClass} ${row.state === 'posted' ? 'bg-emerald-600 text-white' : row.state === 'cancelled' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>{row.state}</span> },
    { key: 'reference', header: 'Reference', cell: (row) => row.reference || '—' },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1"><button title="View" onClick={() => void edit(row, true)} className={actionBtnView}><Eye className="size-4" /></button>{row.state === 'draft' && <><button title="Edit" onClick={() => void edit(row)} className={actionBtnEdit}><Edit3 className="size-4" /></button><button title="Post" onClick={() => setPostTarget(row)} className={actionBtnView}><Send className="size-4" /></button><button title="Delete" onClick={() => setDeleteTarget(row)} className={actionBtnDelete}><Trash2 className="size-4" /></button></>}{row.state === 'posted' && <button title="Print" onClick={() => void printReceipt(row)} className={actionBtnView}><Printer className="size-4" /></button>}</div> },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className={pageHeaderWrapperClass}><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Receivables</p><h1 className={pageHeaderTitleClass}>Customer Receipts</h1><p className="mt-1 text-sm text-muted-foreground">Record customer payments and allocate them to posted invoices.</p></div>
      <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search receipts..." emptyText="No customer receipts found" minWidth="1500px" action={<button onClick={newReceipt} className={btnCreatePage}><Plus className="size-4" /> New receipt</button>} filters={<><select value={status} onChange={(e) => setStatus(e.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select><select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={dashboardSelectClass}><option value="all">All customers</option>{customers.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select><select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={dashboardSelectClass}><option value="all">All methods</option>{methods.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select><input aria-label="From date" title="From date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={dashboardSelectClass} /><input aria-label="To date" title="To date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={dashboardSelectClass} /><button title="Refresh receipts" onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className="size-4" /></button></>} />

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{viewOnly ? 'Customer receipt' : selected ? 'Edit customer receipt' : 'Customer receipt'}</DialogTitle><DialogDescription>Enter the receipt details and select the outstanding invoices to pay.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <fieldset disabled={viewOnly || saving} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">Customer *<select required value={form.customer_id} onChange={(e) => void selectCustomer(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3"><option value="">Select customer</option>{customers.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></label>
            <label className="text-sm font-medium">Receipt date *<input required type="date" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label>
            <label className="text-sm font-medium">Amount *<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => changeReceiptAmount(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label>
            <label className="text-sm font-medium">Payment method *<select required value={form.payment_method_id} onChange={(e) => selectPaymentMethod(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3"><option value="">Select method</option>{methods.filter((row) => row.is_active !== false && row.gl_account_id && ['inbound', 'both'].includes(String(row.payment_type))).map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></label>
            <label className="text-sm font-medium">Reference<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label>
            <label className="text-sm font-medium md:col-span-3">Notes<textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border bg-background p-3" /></label>
          </fieldset>
          <div className="rounded-2xl border"><div className="flex items-center justify-between gap-4 border-b p-4"><div><h3 className="font-semibold">Outstanding Invoices</h3><p className="text-xs text-muted-foreground">Select invoices, then control each allocation manually.</p></div>{openInvoices.length > 0 && <button disabled={viewOnly || !form.amount || !form.allocations.length} type="button" onClick={autoAllocate} className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Recalculate</button>}</div>
            <div className="max-h-64 overflow-auto">{!form.customer_id ? <p className="p-6 text-center text-sm text-muted-foreground">Select a customer first.</p> : openInvoices.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No outstanding posted invoices found for this customer.</p> : <><div className="grid min-w-[850px] grid-cols-[auto_1.4fr_repeat(5,auto)] items-center gap-4 bg-muted/40 px-3 py-2 text-xs font-semibold"><span>Select</span><span>Invoice</span><span className="text-right">Total</span><span className="text-right">Already Paid</span><span className="text-right">Balance</span><span>Status</span><span className="w-32 text-right">Amount to Receive</span></div>{openInvoices.map((invoice) => { const allocation = form.allocations.find((row) => row.invoice_id === invoice.id); const isSelected = Boolean(allocation); const transactionOutstanding = Number(invoice.amount_due) + (viewOnly && selected?.state === 'posted' && allocation ? Number(allocation.allocated_amount) : 0); return <div key={invoice.id} className="grid min-w-[850px] grid-cols-[auto_1.4fr_repeat(5,auto)] items-center gap-4 border-t p-3 text-sm"><input aria-label={`Select ${invoice.invoice_number}`} disabled={viewOnly} type="checkbox" checked={isSelected} onChange={(event) => toggleInvoice(invoice, event.target.checked)} className="size-4 accent-primary" /><div><b>{invoice.invoice_number}</b><p className="text-xs text-muted-foreground">Invoice {dateValue(invoice.invoice_date)} · Due {dateValue(invoice.due_date)}</p></div><div className="text-right"><b>{money(invoice.amount_total, invoice.currencies?.code)}</b></div><div className="text-right"><b>{money(Number(invoice.amount_total) - transactionOutstanding)}</b></div><div className="text-right"><b>{money(transactionOutstanding)}</b></div><span className="capitalize">{invoice.payment_state === 'partial' ? 'Partially Paid' : invoice.payment_state === 'paid' ? 'Paid' : 'Posted'}</span><input aria-label={`Allocate to ${invoice.invoice_number}`} disabled={viewOnly || !isSelected} type="number" min="0" max={transactionOutstanding} step=".01" value={allocation?.allocated_amount ?? ''} onChange={(event) => setAllocation(invoice, event.target.value)} className="h-10 w-32 rounded-lg border px-3 text-right disabled:bg-muted" placeholder="0.00" /></div>; })}</>}</div>
          </div>
          {allocationInvalid && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.</div>}
          {!allocationInvalid && unallocated > 0.005 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The remaining amount is unallocated and will not be applied to any unselected invoice.</div>}
          <div className="ml-auto w-full rounded-2xl border p-4 sm:max-w-sm"><h3 className="mb-3 font-semibold">Summary</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Receipt Amount</span><b>{money(form.amount)}</b></div><div className="flex justify-between"><span>Outstanding Before</span><b>{money(selectedOutstandingBefore)}</b></div><div className="flex justify-between"><span>Allocated</span><b>{money(allocated)}</b></div><div className={`flex justify-between ${unallocated < -0.005 ? 'text-rose-600' : ''}`}><span>Remaining</span><b>{money(unallocated)}</b></div><div className="flex justify-between border-t pt-2"><span>Outstanding After Payment</span><b>{money(outstandingAfterPayment)}</b></div></div></div>
          <DialogFooter><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-5 py-2.5">{viewOnly ? 'Close' : 'Cancel'}</button>{!viewOnly && <><button disabled={saving || allocationInvalid || allocated <= 0.005} className="rounded-xl border px-5 py-2.5 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save Draft'}</button><button type="button" disabled={saving || allocationInvalid || allocated <= 0.005} onClick={(event) => { if (event.currentTarget.form?.reportValidity()) void save(undefined, true); }} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Post Receipt</button></>}</DialogFooter>
        </form>
      </DialogContent></Dialog>
      <Dialog open={Boolean(postTarget)} onOpenChange={(value) => !saving && !value && setPostTarget(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Send className="size-5" /></div><DialogTitle>Post Customer Receipt</DialogTitle><DialogDescription>Confirm the receipt before updating the selected invoice balances.</DialogDescription></DialogHeader>{postTarget && <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Receipt</p><p className="mt-1 font-semibold">{postTarget.receipt_number}</p></div><div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-semibold">{postTarget.customers?.name || '—'}</p></div><div><p className="text-xs text-muted-foreground">Receipt Date</p><p className="mt-1 font-semibold">{dateValue(postTarget.receipt_date)}</p></div><div><p className="text-xs text-muted-foreground">Amount</p><p className="mt-1 font-semibold">{money(postTarget.amount, postTarget.currencies?.code)}</p></div></div>}<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Posting updates invoice balances and locks this receipt from further editing.</div><DialogFooter><button type="button" disabled={saving} onClick={() => setPostTarget(null)} className="h-10 rounded-xl border px-5 font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={saving || !postTarget} onClick={() => postTarget && void post(postTarget)} className="h-10 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Posting…' : 'Post Receipt'}</button></DialogFooter></DialogContent></Dialog>
      <AccountingConfirmDialog open={Boolean(deleteTarget)} title="Delete Customer Receipt" description="Confirm removal of this draft customer receipt." confirmLabel="Delete Receipt" destructive busy={saving} details={deleteTarget && <div className="flex justify-between"><span className="text-muted-foreground">Receipt</span><b>{deleteTarget.receipt_number}</b></div>} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && void remove(deleteTarget)} />
      {printTarget && <PrintableCustomerReceipt receipt={printTarget} />}
    </div>
  );
}

function PrintableCustomerReceipt({ receipt }: { receipt: CustomerReceipt }) {
  const currency = receipt.currencies?.code || '';
  const allocated = Number(receipt.amount) - Number(receipt.unallocated_amount || 0);
  return <section id="printable-customer-receipt" className="hidden bg-white text-slate-950 print:block">
    <header className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
      <div><h1 className="text-3xl font-bold text-[#6f0d18]">Ruut Caffe</h1><p className="mt-1 text-sm text-slate-500">Customer payment receipt</p></div>
      <div className="text-right"><h2 className="text-3xl font-semibold">RECEIPT</h2><p className="mt-2 font-bold">{receipt.receipt_number || `#${receipt.id}`}</p></div>
    </header>
    <div className="grid grid-cols-2 gap-10 py-7 text-sm">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Received from</p><p className="mt-2 text-base font-bold">{receipt.customers?.name || `Customer #${receipt.customer_id}`}</p>{receipt.customers?.phone && <p>{receipt.customers.phone}</p>}</div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-right"><dt className="text-slate-500">Receipt date</dt><dd className="font-semibold">{dateValue(receipt.receipt_date)}</dd><dt className="text-slate-500">Payment method</dt><dd className="font-semibold">{receipt.payment_methods?.name || '—'}</dd><dt className="text-slate-500">Account</dt><dd className="font-semibold">{receipt.journals?.name || '—'}</dd><dt className="text-slate-500">Reference</dt><dd className="font-semibold">{receipt.reference || '—'}</dd></dl>
    </div>
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount received</p><p className="mt-2 text-3xl font-bold">{money(receipt.amount, currency)}</p></div>
    <h3 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider">Invoice allocation</h3>
    <table className="w-full border-collapse text-sm"><thead><tr className="bg-[#6f0d18] text-white"><th className="p-3 text-left">Invoice</th><th className="p-3 text-right">Invoice total</th><th className="p-3 text-right">Amount applied</th></tr></thead><tbody>{(receipt.receipt_allocations || []).map((allocation, index) => <tr key={allocation.id || index} className="border-b"><td className="p-3 font-medium">{allocation.customer_invoices?.invoice_number || `Invoice #${allocation.invoice_id}`}</td><td className="p-3 text-right">{money(allocation.customer_invoices?.amount_total, currency)}</td><td className="p-3 text-right font-semibold">{money(allocation.allocated_amount, currency)}</td></tr>)}</tbody></table>
    <div className="ml-auto mt-7 w-80 text-sm"><div className="flex justify-between py-1"><span>Receipt</span><b>{money(receipt.amount, currency)}</b></div><div className="flex justify-between py-1"><span>Allocated</span><b>{money(allocated, currency)}</b></div><div className="my-2 border-t border-slate-400" /><div className="flex justify-between py-2 text-base font-bold"><span>Remaining</span><span>{money(receipt.unallocated_amount, currency)}</span></div></div>
  </section>;
}

