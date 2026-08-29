'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Edit3, Eye, Plus, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { creditNoteApi, type CreditNote } from '@/lib/api/accounting/receivables/creditNoteApi';
import { customerInvoiceApi, type CustomerInvoice, type CustomerInvoiceLine } from '@/lib/api/accounting/receivables/customerInvoiceApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Line = {
  product_id?: number | null; description: string; quantity: number; unit_price: number;
  discount_percent: number; tax_id?: number | null; income_account_id: number;
  tax_rate?: number; price_includes_tax?: boolean;
};
type Form = {
  reversed_invoice_id: string; invoice_date: string; customer_reference: string;
  notes: string; lines: Line[];
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): Form => ({ reversed_invoice_id: '', invoice_date: today(), customer_reference: '', notes: '', lines: [] });
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown, code = '') => `${code ? `${code} ` : ''}${Number(value || 0).toFixed(2)}`;
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

export default function CreditNotesPage() {
  const { showToast } = useToast();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<CreditNote | null>(null);
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete'; note: CreditNote } | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notes, invoiceRows] = await Promise.all([creditNoteApi.getAll(), customerInvoiceApi.getAll()]);
      setCreditNotes(notes); setInvoices(invoiceRows);
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const creditedByInvoice = useMemo(() => {
    const totals = new Map<number, number>();
    creditNotes.filter((note) => note.state === 'posted').forEach((note) => {
      totals.set(note.reversed_invoice_id, (totals.get(note.reversed_invoice_id) || 0) + Number(note.amount_total));
    });
    return totals;
  }, [creditNotes]);
  const availableCredit = (invoice?: CustomerInvoice) => invoice
    ? Math.max(0, Number(invoice.amount_total) - (creditedByInvoice.get(invoice.id) || 0))
    : 0;
  const eligibleInvoices = invoices.filter((invoice) => invoice.state === 'posted' && availableCredit(invoice) > 0.005);
  const original = invoices.find((invoice) => invoice.id === Number(form.reversed_invoice_id));
  const total = useMemo(() => form.lines.reduce((sum, line) => {
    const gross = Number(line.quantity || 0) * Number(line.unit_price || 0);
    const discounted = gross * (1 - Number(line.discount_percent || 0) / 100);
    return sum + (line.tax_id && !line.price_includes_tax ? discounted * (1 + Number(line.tax_rate || 0) / 100) : discounted);
  }, 0), [form.lines]);
  const customers = [...new Map(creditNotes.filter((row) => row.customers).map((row) => [row.customer_id, row.customers!])).values()];
  const filtered = creditNotes.filter((note) => {
    const needle = query.trim().toLowerCase();
    const day = dateValue(note.invoice_date);
    return (!needle || [note.invoice_number, note.customers?.name, note.customer_invoices?.invoice_number, note.customer_reference].some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (status === 'all' || note.state === status) &&
      (customerFilter === 'all' || note.customer_id === Number(customerFilter)) &&
      (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
  });

  function createNote() {
    setSelected(null); setViewOnly(false); setForm(emptyForm()); setOpen(true);
  }
  function chooseInvoice(value: string) {
    const invoice = invoices.find((row) => row.id === Number(value));
    const lines = (invoice?.customer_invoice_lines || []).map((line: CustomerInvoiceLine): Line => ({
      product_id: line.product_id || null, description: line.description, quantity: Number(line.quantity),
      unit_price: Number(line.unit_price), discount_percent: Number(line.discount_percent),
      tax_id: line.tax_id || null, income_account_id: Number(line.income_account_id),
      tax_rate: Number(line.taxes?.rate_percent || 0), price_includes_tax: Boolean(line.taxes?.price_includes_tax),
    }));
    setForm((current) => ({ ...current, reversed_invoice_id: value, lines }));
  }
  function edit(note: CreditNote, readOnly = false) {
    setSelected(note); setViewOnly(readOnly || note.state !== 'draft');
    setForm({
      reversed_invoice_id: String(note.reversed_invoice_id), invoice_date: dateValue(note.invoice_date),
      customer_reference: String(note.customer_reference || ''), notes: String(note.notes || ''),
      lines: (note.customer_invoice_lines || []).map((line) => ({
        product_id: line.product_id || null, description: line.description, quantity: Number(line.quantity),
        unit_price: Number(line.unit_price), discount_percent: Number(line.discount_percent),
        tax_id: line.tax_id || null, income_account_id: Number(line.income_account_id),
        tax_rate: Number(line.taxes?.rate_percent || 0), price_includes_tax: Boolean(line.taxes?.price_includes_tax),
      })),
    });
    setOpen(true);
  }
  function updateLine(index: number, patch: Partial<Line>) {
    setForm((current) => ({ ...current, lines: current.lines.map((line, i) => i === index ? { ...line, ...patch } : line) }));
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, reversed_invoice_id: Number(form.reversed_invoice_id), invoice_date: new Date(`${form.invoice_date}T00:00:00.000Z`).toISOString() };
      if (selected) await creditNoteApi.update(selected.id, payload);
      else await creditNoteApi.create(payload);
      showToast(selected ? 'Draft credit note updated successfully' : 'Draft credit note created successfully', 'success');
      setOpen(false); await load();
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setSaving(false); }
  }
  async function post(note: CreditNote) {
    setSaving(true); try { await creditNoteApi.post(note.id); showToast('Credit note posted successfully', 'success'); setPendingAction(null); await load(); }
    catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  async function remove(note: CreditNote) {
    setSaving(true); try { await creditNoteApi.remove(note.id); showToast('Draft credit note deleted', 'success'); setPendingAction(null); await load(); }
    catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  function print(note: CreditNote) {
    edit(note, true); window.setTimeout(() => window.print(), 150);
  }
  const columns: DashboardTableColumn<CreditNote>[] = [
    { key: 'number', header: 'Credit Note', cell: (note) => <span className="font-bold text-primary">{note.invoice_number}</span> },
    { key: 'date', header: 'Date', cell: (note) => dateValue(note.invoice_date) },
    { key: 'customer', header: 'Customer', cell: (note) => note.customers?.name || '—' },
    { key: 'invoice', header: 'Original Invoice', cell: (note) => note.customer_invoices?.invoice_number || '—' },
    { key: 'currency', header: 'Currency', cell: (note) => note.currencies?.code || '—' },
    { key: 'amount', header: 'Amount', align: 'right', cell: (note) => <span className="font-semibold">{money(note.amount_total)}</span> },
    { key: 'status', header: 'Status', align: 'center', cell: (note) => <span className={`${dashboardStatusBadgeClass} ${note.state === 'posted' ? 'bg-emerald-600 text-white' : note.state === 'cancelled' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>{note.state}</span> },
    { key: 'reference', header: 'Reference', cell: (note) => note.customer_reference || '—' },
    { key: 'actions', header: 'Actions', align: 'right', cell: (note) => <div className="flex justify-end gap-1"><button title="View" onClick={() => edit(note, true)} className={actionBtnView}><Eye className="size-4" /></button>{note.state === 'draft' && <><button title="Edit" onClick={() => edit(note)} className={actionBtnEdit}><Edit3 className="size-4" /></button><button title="Post" onClick={() => setPendingAction({ type: 'post', note })} className={actionBtnView}><Send className="size-4" /></button><button title="Delete" onClick={() => setPendingAction({ type: 'delete', note })} className={actionBtnDelete}><Trash2 className="size-4" /></button></>}{note.state === 'posted' && <button title="Print" onClick={() => print(note)} className={actionBtnView}><Printer className="size-4" /></button>}</div> },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className={pageHeaderWrapperClass}><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Receivables</p><h1 className={pageHeaderTitleClass}>Credit Notes</h1><p className="mt-1 text-sm text-muted-foreground">Create customer credits against posted invoices.</p></div>
      <DashboardDataTable
        rows={filtered}
        columns={columns}
        loading={loading}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search credit notes..."
        emptyText="No credit notes found"
        minWidth="1100px"
        action={<button onClick={createNote} className={btnCreatePage}><Plus className="size-4" /> New credit note</button>}
        filters={<><select value={status} onChange={(e) => setStatus(e.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select><select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={dashboardSelectClass}><option value="all">All customers</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><input aria-label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={dashboardSelectClass} /><input aria-label="Date to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={dashboardSelectClass} /><button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className="size-4" /></button></>}
      />

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{viewOnly ? 'Credit note' : selected ? 'Edit draft credit note' : 'New credit note'}</DialogTitle><DialogDescription>A draft does not affect the invoice or General Ledger until posted.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-5"><div className="grid gap-4 rounded-xl border bg-muted/30 p-4 md:grid-cols-3"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Credit Note Number</p><p className="mt-1 font-semibold">{selected?.invoice_number || 'Auto-generated (CN####)'}</p></div><div><p className="text-xs font-semibold uppercase text-muted-foreground">Status</p><p className="mt-1 font-semibold uppercase">{selected?.state || 'draft'}</p></div><div><p className="text-xs font-semibold uppercase text-muted-foreground">Total Credit</p><p className="mt-1 font-semibold">{money(total, original?.currencies?.code)}</p></div></div>
          <fieldset disabled={viewOnly || saving} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Original posted invoice *<select required value={form.reversed_invoice_id} onChange={(e) => chooseInvoice(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3"><option value="">Select invoice</option>{eligibleInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} — {invoice.customers?.name} — Creditable {money(availableCredit(invoice), invoice.currencies?.code)}{Number(invoice.amount_due) <= 0 ? ' (Paid)' : ''}</option>)}</select></label><label className="text-sm font-medium">Credit note date *<input required type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label><label className="text-sm font-medium">Reference<input value={form.customer_reference} onChange={(e) => setForm({ ...form, customer_reference: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label><label className="text-sm font-medium">Reason / Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label></fieldset>
          <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Description</th><th className="p-3">Quantity</th><th className="p-3">Unit Price</th><th className="p-3">Discount %</th><th className="p-3 text-right">Line Total</th></tr></thead><tbody>{form.lines.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Select an original invoice to load its lines.</td></tr> : form.lines.map((line, index) => <tr key={index} className="border-t"><td className="p-3"><input disabled={viewOnly} required value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} className="h-10 w-full rounded-lg border px-3" /></td><td className="p-3"><input disabled={viewOnly} required min="1" step="1" type="number" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} className="h-10 w-28 rounded-lg border px-3" /></td><td className="p-3"><input disabled={viewOnly} required min="0" step="1" type="number" value={line.unit_price} onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })} className="h-10 w-32 rounded-lg border px-3" /></td><td className="p-3"><input disabled={viewOnly} min="0" max="100" step="0.01" type="number" value={line.discount_percent} onChange={(e) => updateLine(index, { discount_percent: Number(e.target.value) })} className="h-10 w-24 rounded-lg border px-3" /></td><td className="p-3 text-right font-semibold">{money(line.quantity * line.unit_price * (1 - line.discount_percent / 100))}</td></tr>)}</tbody></table></div>
          {original && total > availableCredit(original) + 0.005 && <p className="text-sm font-medium text-destructive">Credit total cannot exceed the remaining creditable amount of {money(availableCredit(original), original.currencies?.code)}.</p>}
          <DialogFooter><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-5 py-2.5">Close</button>{!viewOnly && <button disabled={saving || !form.lines.length || total <= 0 || Boolean(original && total > availableCredit(original) + 0.005)} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Saving…' : 'Save draft credit note'}</button>}</DialogFooter>
        </form>
      </DialogContent></Dialog>
      <AccountingConfirmDialog open={Boolean(pendingAction)} title={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Credit Note`} description={pendingAction?.type === 'delete' ? 'Confirm removal of this draft credit note.' : 'Confirm this credit note before reducing the original invoice balance.'} confirmLabel={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Credit Note`} destructive={pendingAction?.type === 'delete'} busy={saving} details={pendingAction && <div className="flex justify-between"><span className="text-muted-foreground">Credit Note</span><b>{pendingAction.note.invoice_number}</b></div>} onCancel={() => setPendingAction(null)} onConfirm={() => pendingAction && void (pendingAction.type === 'delete' ? remove(pendingAction.note) : post(pendingAction.note))} />
    </div>
  );
}
