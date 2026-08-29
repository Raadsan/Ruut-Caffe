'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Eye, Plus, Printer, RefreshCw, Send, Trash2, Edit3, X } from 'lucide-react';
import { customerInvoiceApi, type CustomerInvoice, type CustomerInvoiceLine } from '@/lib/api/accounting/receivables/customerInvoiceApi';
import { accountingCustomerApi } from '@/lib/api/accounting/receivables/customerApi';
import { accountingProductApi } from '@/lib/api/accounting/catalog/productApi';
import { accountingTaxApi } from '@/lib/api/accounting/configuration/taxApi';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';
import { paymentTermApi } from '@/lib/api/accounting/configuration/paymentTermApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { customerReceiptApi } from '@/lib/api/accounting/receivables/customerReceiptApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Line = Omit<CustomerInvoiceLine, 'id' | 'products' | 'subtotal'>;
type Form = {
  customer_id: string; invoice_date: string; due_date: string; payment_term_id: string; notes: string; lines: Line[];
  receive_payment_now: boolean; payment_method_id: string; amount_received: string; payment_reference: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ product_id: null, description: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null });
const emptyForm = (): Form => ({ customer_id: '', invoice_date: today(), due_date: today(), payment_term_id: '', notes: '', lines: [emptyLine()], receive_payment_now: false, payment_method_id: '', amount_received: '', payment_reference: '' });
const apiDate = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString();
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown, code = '') => `${code ? `${code} ` : ''}${Number(value || 0).toFixed(2)}`;
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

export default function CustomerInvoicesPage() {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [taxes, setTaxes] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [terms, setTerms] = useState<Row[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<CustomerInvoice | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete'; invoice: CustomerInvoice } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewOnly, setViewOnly] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<CustomerInvoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Product loading also backfills menu-item VAT mappings. Finish it before
      // reading taxes so a newly discovered VAT rate is present in the dropdown.
      const productRows = await accountingProductApi.getAll();
      const [invoiceRows, customerRows, taxRows, currencyRows, termRows, methodRows] = await Promise.all([
        customerInvoiceApi.getAll(), accountingCustomerApi.getAll(), accountingTaxApi.getAll(),
        currencyApi.getAll(), paymentTermApi.getAll(), accountingPaymentMethodApi.getAll(),
      ]);
      setInvoices(invoiceRows); setCustomers(customerRows); setProducts(productRows); setTaxes(taxRows); setCurrencies(currencyRows);
      setTerms(termRows);
      setPaymentMethods(methodRows);
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const totals = useMemo(() => form.lines.reduce((sum, line) => {
    const gross = Number(line.quantity || 0) * Number(line.unit_price || 0);
    const discounted = gross * (1 - Number(line.discount_percent || 0) / 100);
    const tax = taxes.find((item) => item.id === Number(line.tax_id));
    const rate = Number(tax?.rate_percent || 0) / 100;
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted;
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0;
    return { untaxed: sum.untaxed + untaxed, discount: sum.discount + gross - discounted, tax: sum.tax + taxAmount, total: sum.total + untaxed + taxAmount };
  }, { untaxed: 0, discount: 0, tax: 0, total: 0 }), [form.lines, taxes]);

  const filtered = invoices.filter((invoice) => {
    const needle = query.trim().toLowerCase();
    const searchable = !needle || [invoice.invoice_number, invoice.customers?.name, invoice.state, invoice.payment_state].some((value) => String(value || '').toLowerCase().includes(needle));
    const effectiveStatus = invoice.state === 'cancelled' ? 'cancelled' : invoice.payment_state === 'paid' ? 'paid' : invoice.payment_state === 'partial' ? 'partial' : invoice.state;
    const invoiceDay = dateValue(invoice.invoice_date);
    return searchable &&
      (statusFilter === 'all' || effectiveStatus === statusFilter) &&
      (currencyFilter === 'all' || Number(invoice.currency_id) === Number(currencyFilter)) &&
      (customerFilter === 'all' || Number(invoice.customer_id) === Number(customerFilter)) &&
      (!dateFrom || invoiceDay >= dateFrom) && (!dateTo || invoiceDay <= dateTo);
  });

  function createInvoice() {
    setSelected(null);
    setViewOnly(false);
    const next = emptyForm();
    const immediate = terms.find((item) => /immediate/i.test(String(item.name)));
    if (immediate) next.payment_term_id = String(immediate.id);
    setForm(next); setOpen(true);
  }
  function editInvoice(invoice: CustomerInvoice) {
    setSelected(invoice);
    setViewOnly(invoice.state !== 'draft');
    setForm({
      customer_id: String(invoice.customer_id), invoice_date: dateValue(invoice.invoice_date), due_date: dateValue(invoice.due_date),
      payment_term_id: String(invoice.payment_term_id || ''), notes: String(invoice.notes || ''),
      lines: (invoice.customer_invoice_lines || []).map((line) => ({ product_id: line.product_id || null, description: line.description, quantity: Number(line.quantity), unit_price: Number(line.unit_price), discount_percent: Number(line.discount_percent), tax_id: line.tax_id || null })),
      receive_payment_now: false, payment_method_id: '', amount_received: '', payment_reference: '',
    });
    setOpen(true);
  }
  function selectCustomer(value: string) {
    const nextCustomer = customers.find((item) => item.id === Number(value));
    const termId = nextCustomer?.payment_term_id || terms.find((item) => /immediate/i.test(String(item.name)))?.id || '';
    const due = new Date(`${form.invoice_date}T00:00:00.000Z`); due.setUTCDate(due.getUTCDate() + paymentDays(String(termId)));
    setForm((current) => ({ ...current, customer_id: value, payment_term_id: String(termId), due_date: due.toISOString().slice(0, 10) }));
  }
  function paymentDays(termId: string) {
    const name = String(terms.find((item) => item.id === Number(termId))?.name || '');
    if (/immediate/i.test(name)) return 0;
    return Number(name.match(/\d+/)?.[0] || 0);
  }
  function setPaymentTerm(value: string) {
    const due = new Date(`${form.invoice_date}T00:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() + paymentDays(value));
    setForm({ ...form, payment_term_id: value, due_date: due.toISOString().slice(0, 10) });
  }
  function setInvoiceDate(value: string) {
    const due = new Date(`${value}T00:00:00.000Z`); due.setUTCDate(due.getUTCDate() + paymentDays(form.payment_term_id));
    setForm({ ...form, invoice_date: value, due_date: due.toISOString().slice(0, 10) });
  }
  function updateLine(index: number, patch: Partial<Line>) {
    setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }));
  }
  function chooseProduct(index: number, value: string) {
    const product = products.find((item) => item.id === Number(value));
    updateLine(index, product ? { product_id: product.id, description: String(product.name), unit_price: Number(product.list_price || 0), tax_id: Number(product.sale_tax_id) || null } : { product_id: null });
  }
  async function save(postAfterSave = false) {
    const amountReceived = Number(form.amount_received || 0);
    if (postAfterSave && form.receive_payment_now) {
      if (!form.payment_method_id) return showToast('Select a payment method for the immediate payment.', 'error');
      if (!Number.isFinite(amountReceived) || amountReceived <= 0) return showToast('Amount received must be greater than zero.', 'error');
      if (amountReceived > totals.total + 0.005) return showToast('Amount received cannot exceed the invoice total.', 'error');
      try {
        const options = await customerReceiptApi.options({ customer_id: Number(form.customer_id), payment_method_id: Number(form.payment_method_id) });
        if (!options.accounts.length) return showToast('The selected payment method has no compatible active money account and journal.', 'error');
      } catch (error) { return showToast(errorMessage(error), 'error'); }
    }
    setSaving(true);
    const payload = {
      notes: form.notes, lines: form.lines.map((line) => ({ ...line, description: line.description || String(products.find((product) => product.id === Number(line.product_id))?.name || 'Custom line') })), customer_id: Number(form.customer_id),
      invoice_date: apiDate(form.invoice_date), due_date: form.due_date ? apiDate(form.due_date) : null, payment_term_id: form.payment_term_id ? Number(form.payment_term_id) : null,
    };
    try {
      const saved = selected ? await customerInvoiceApi.update(selected.id, payload) : await customerInvoiceApi.create(payload);
      if (postAfterSave) {
        const postedInvoice = await customerInvoiceApi.post(saved.id);
        if (form.receive_payment_now) {
          const receipt = await customerReceiptApi.create({
            customer_id: postedInvoice.customer_id,
            payment_method_id: Number(form.payment_method_id),
            receipt_date: apiDate(form.invoice_date),
            amount: amountReceived,
            reference: form.payment_reference.trim() || undefined,
            memo: `Immediate payment for invoice ${postedInvoice.invoice_number}`,
            allocations: [{ invoice_id: postedInvoice.id, allocated_amount: amountReceived }],
          });
          await customerReceiptApi.post(receipt.id);
        }
      }
      showToast(postAfterSave ? form.receive_payment_now ? 'Invoice and payment posted successfully' : 'Invoice posted successfully' : `Draft invoice ${selected ? 'updated' : 'created'} successfully`, 'success');
      setOpen(false); await load();
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setSaving(false); }
  }
  async function remove(invoice: CustomerInvoice) {
    setSaving(true); try { await customerInvoiceApi.remove(invoice.id); showToast('Draft invoice deleted successfully', 'success'); setPendingAction(null); await load(); }
    catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  async function postInvoice(invoice: CustomerInvoice) {
    setSaving(true); try { await customerInvoiceApi.post(invoice.id); showToast('Invoice and journal entry posted successfully', 'success'); setPendingAction(null); await load(); }
    catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  function print(invoice: CustomerInvoice) {
    setPrintInvoice(invoice);
    window.setTimeout(() => window.print(), 100);
  }
  const columns: DashboardTableColumn<CustomerInvoice>[] = [
    { key: 'number', header: 'Invoice', cell: (row) => <span className="font-bold text-primary">{row.invoice_number}</span> },
    { key: 'customer', header: 'Customer', cell: (row) => row.customers?.name || `#${row.customer_id}` },
    { key: 'date', header: 'Invoice Date', cell: (row) => dateValue(row.invoice_date) },
    { key: 'due', header: 'Due Date', cell: (row) => dateValue(row.due_date) },
    { key: 'currency', header: 'Currency', cell: (row) => row.currencies?.code || '—' },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <Status invoice={row} /> },
    { key: 'subtotal', header: 'Subtotal', align: 'right', cell: (row) => money(row.amount_untaxed) },
    { key: 'tax', header: 'Tax', align: 'right', cell: (row) => money(row.amount_tax) },
    { key: 'total', header: 'Total', align: 'right', cell: (row) => <span className="font-semibold">{money(row.amount_total)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', cell: (row) => money(row.paid_amount ?? Number(row.amount_total) - Number(row.amount_due)) },
    { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (row) => money(row.amount_due) },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1">{row.state === 'draft' ? <><button title="Edit" onClick={() => editInvoice(row)} className={actionBtnEdit}><Edit3 className="size-4" /></button><button title="Post" onClick={() => setPendingAction({ type: 'post', invoice: row })} className={actionBtnView}><Send className="size-4" /></button><button title="Delete" onClick={() => setPendingAction({ type: 'delete', invoice: row })} className={actionBtnDelete}><Trash2 className="size-4" /></button></> : <><button title="View" onClick={() => editInvoice(row)} className={actionBtnView}><Eye className="size-4" /></button><button title="Print" onClick={() => print(row)} className={actionBtnView}><Printer className="size-4" /></button></>}</div> },
  ];

  return <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
    <div className={pageHeaderWrapperClass}><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Receivables</p><h1 className={pageHeaderTitleClass}>Customer Invoices</h1><p className="mt-1 text-sm text-muted-foreground">Prepare and manage customer sales invoices.</p></div>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search invoices..." emptyText="No customer invoices found" minWidth="1350px" action={<button onClick={createInvoice} className={btnCreatePage}><Plus className="size-4" /> New invoice</button>} filters={<><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All customers</option>{customers.map((item) => <option key={item.id} value={item.id}>{String(item.name)}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="partial">Partially paid</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select><select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All currencies</option>{currencies.map((item) => <option key={item.id} value={item.id}>{String(item.code)}</option>)}</select><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={dashboardSelectClass} /><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={dashboardSelectClass} /><button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />
    <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}><DialogContent className="max-h-[94vh] max-w-[calc(100vw-2rem)] overflow-y-auto xl:max-w-[1400px]"><DialogHeader><DialogTitle>{viewOnly ? 'View' : selected ? 'Edit' : 'Prepare'} customer invoice</DialogTitle><DialogDescription>{viewOnly ? 'Posted invoices are read-only.' : 'Invoice number, company, and accounting defaults are applied automatically.'}</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4"><fieldset disabled={viewOnly} className="contents">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Customer" value={form.customer_id} set={selectCustomer} rows={customers} />
        <Field label="Invoice date" type="date" value={form.invoice_date} set={setInvoiceDate} />
        <Field label="Due date" type="date" value={form.due_date} set={(value) => setForm({ ...form, due_date: value })} />
        <Select label="Payment term" value={form.payment_term_id} set={setPaymentTerm} rows={terms} optional />
      </div>
      <div className="space-y-3"><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[900px] table-fixed text-xs"><colgroup><col className="w-[18%]" /><col className="w-[24%]" /><col className="w-[10%]" /><col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[16%]" /><col className="w-[5%]" /></colgroup><thead className="bg-muted/50"><tr><th className="p-2.5 text-left">Product</th><th className="p-2.5 text-left">Description</th><th className="p-2.5">Qty</th><th className="p-2.5">Unit price</th><th className="p-2.5">Discount</th><th className="p-2.5">Tax</th><th className="w-9"></th></tr></thead><tbody>{form.lines.map((line, index) => <tr key={index} className="border-t">
        <td className="p-2"><ProductPicker value={line.product_id} products={products.filter((item) => item.is_active !== false && item.can_be_sold !== false)} onChange={(value) => chooseProduct(index, value)} /></td>
        <td className="p-2"><input required value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} className="h-9 w-full rounded-lg border px-2" placeholder="Product or service description" /></td>
        <td className="p-2"><input required type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="h-9 w-full rounded-lg border px-2" /></td>
        <td className="p-2"><input required type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => updateLine(index, { unit_price: Number(event.target.value) })} className="h-9 w-full rounded-lg border px-2" /></td>
        <td className="p-2"><input type="number" min="0" max="100" step="0.01" value={line.discount_percent} onChange={(event) => updateLine(index, { discount_percent: Number(event.target.value) })} className="h-9 w-full rounded-lg border px-2" /></td>
        <td className="p-2"><select value={line.tax_id || ''} onChange={(event) => updateLine(index, { tax_id: Number(event.target.value) || null })} className="h-9 w-full rounded-lg border px-2"><option value="">No tax</option>{taxes.filter((item) => item.is_active !== false && Number(item.rate_percent || 0) !== 0).map((item) => <option key={item.id} value={item.id}>{String(item.name)}</option>)}</select></td>
        <td className="p-2"><button type="button" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })} className="rounded p-1 text-rose-600 disabled:opacity-30"><X className="size-4" /></button></td>
      </tr>)}</tbody></table><button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })} className="m-2.5 flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-3" /> Add line</button></div>
        </div>
        {!viewOnly && <section className="rounded-xl border bg-muted/10 p-4"><h3 className="font-semibold">Payment Information</h3><label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.receive_payment_now} onChange={(event) => setForm((current) => ({ ...current, receive_payment_now: event.target.checked, payment_method_id: event.target.checked ? current.payment_method_id : '', amount_received: event.target.checked ? current.amount_received : '', payment_reference: event.target.checked ? current.payment_reference : '' }))} className="size-4 accent-primary" /> Receive Payment Now</label>{form.receive_payment_now && <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-xs font-semibold">Payment Method *<select required value={form.payment_method_id} onChange={(event) => setForm({ ...form, payment_method_id: event.target.value })} className="mt-1 h-10 w-full rounded-lg border bg-background px-3"><option value="">Select payment method</option>{paymentMethods.filter((method) => method.is_active !== false && method.gl_account_id && ['inbound', 'both'].includes(String(method.payment_type))).map((method) => <option key={method.id} value={method.id}>{String(method.name)}</option>)}</select></label><label className="text-xs font-semibold">Amount Received *<input required type="number" min="0.01" max={totals.total || undefined} step="0.01" value={form.amount_received} onChange={(event) => setForm({ ...form, amount_received: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3" /></label><label className="text-xs font-semibold">Reference <span className="font-normal text-muted-foreground">(optional)</span><input value={form.payment_reference} onChange={(event) => setForm({ ...form, payment_reference: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3" /></label></div>}</section>}
        <div className="mt-4 grid items-stretch gap-4 lg:min-h-[170px] lg:grid-cols-[minmax(0,1fr)_280px]"><label className="flex h-full flex-col text-xs font-semibold">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-[140px] w-full flex-1 resize-none rounded-lg border p-2 text-sm" placeholder="Add any notes for this invoice..." /></label><aside className="h-full rounded-xl border bg-muted/20 p-4 text-sm"><p className="mb-3 font-semibold">Invoice summary</p><Total label="Subtotal" value={selected ? Number(selected.amount_untaxed) : totals.untaxed} /><Total label="Tax" value={selected ? Number(selected.amount_tax) : totals.tax} /><div className="my-2 border-t" /><Total label="Grand total" value={selected ? Number(selected.amount_total) : totals.total} strong /><div className="my-2 border-t" /><Total label="Paid" value={selected ? Number(selected.paid_amount || 0) : form.receive_payment_now ? Math.min(Number(form.amount_received || 0), totals.total) : 0} /><Total label="Balance" value={selected ? Number(selected.amount_due) : Math.max(0, totals.total - (form.receive_payment_now ? Number(form.amount_received || 0) : 0))} /><div className="mt-2 flex justify-between gap-4 border-t pt-2"><span>Status</span><b>{selected?.state === 'cancelled' ? 'Cancelled' : selected?.payment_state === 'paid' ? 'Paid' : selected?.payment_state === 'partial' ? 'Partially Paid' : selected?.state === 'posted' ? 'Posted' : form.receive_payment_now && Number(form.amount_received || 0) >= totals.total && totals.total > 0 ? 'Paid' : form.receive_payment_now && Number(form.amount_received || 0) > 0 ? 'Partially Paid' : 'Draft'}</b></div></aside></div>
      </fieldset><DialogFooter><button type="button" onClick={() => setOpen(false)} className="h-9 rounded-xl border px-4">{viewOnly ? 'Close' : 'Cancel'}</button>{!viewOnly && <><button disabled={saving} className="h-9 rounded-xl border px-4 font-semibold">{saving ? 'Saving...' : 'Save Draft'}</button><button type="button" disabled={saving} onClick={(event) => { if (event.currentTarget.form?.reportValidity()) void save(true); }} className="h-9 rounded-xl bg-primary px-4 font-semibold text-white">Post Invoice</button></>}</DialogFooter>
    </form></DialogContent></Dialog>
    <AccountingConfirmDialog open={Boolean(pendingAction)} title={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Customer Invoice`} description={pendingAction?.type === 'delete' ? 'Confirm removal of this draft customer invoice.' : 'Confirm this invoice before posting its journal entry and locking it.'} confirmLabel={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Invoice`} destructive={pendingAction?.type === 'delete'} busy={saving} details={pendingAction && <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><b>{pendingAction.invoice.invoice_number}</b></div>} onCancel={() => setPendingAction(null)} onConfirm={() => pendingAction && void (pendingAction.type === 'delete' ? remove(pendingAction.invoice) : postInvoice(pendingAction.invoice))} />
    {printInvoice && <PrintableInvoice invoice={printInvoice} />}
  </main>;
}

function ProductPicker({ value, products, onChange }: { value?: number | null; products: Row[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = products.find((item) => item.id === Number(value));
  const visible = products.filter((item) => String(item.name || '').toLowerCase().includes(search.trim().toLowerCase()));

  function select(id: number | null) {
    onChange(id ? String(id) : '');
    setOpen(false);
    setSearch('');
  }

  return <div className="relative min-w-0">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-background px-2 text-left">
      <span className="truncate">{selected ? String(selected.name) : 'Custom line'}</span><span className="text-[10px] text-muted-foreground">▼</span>
    </button>
    {open && <div className="mt-1 w-full rounded-lg border bg-background p-1 shadow-sm">
      <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." className="mb-1 h-9 w-full rounded-md border px-2 outline-none focus:border-primary" />
      <div role="listbox" className="max-h-40 overflow-y-auto overscroll-contain">
        <button type="button" role="option" aria-selected={!value} onClick={() => select(null)} className={`block w-full rounded px-2 py-2 text-left hover:bg-muted ${!value ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>Custom line</button>
        {visible.map((item) => <button key={item.id} type="button" role="option" aria-selected={item.id === Number(value)} onClick={() => select(item.id)} className={`block w-full rounded px-2 py-2 text-left hover:bg-muted ${item.id === Number(value) ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>{String(item.name)}</button>)}
        {!visible.length && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matching products</p>}
      </div>
    </div>}
  </div>;
}

function PrintableInvoice({ invoice }: { invoice: CustomerInvoice }) {
  const currency = invoice.currencies?.code || '';
  return <section id="printable-invoice" className="hidden bg-white text-slate-950 print:block">
    <header className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
      <div><h1 className="text-3xl font-bold text-[#6f0d18]">Ruut Caffe</h1><p className="mt-1 text-sm text-slate-500">Customer sales invoice</p></div>
      <div className="text-right"><h2 className="text-3xl font-semibold">INVOICE</h2><p className="mt-2 font-bold">{invoice.invoice_number}</p></div>
    </header>
    <div className="grid grid-cols-2 gap-10 py-7 text-sm">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill to</p><p className="mt-2 text-base font-bold">{invoice.customers?.name || `Customer #${invoice.customer_id}`}</p>{invoice.customers?.phone && <p>{invoice.customers.phone}</p>}</div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-right"><dt className="text-slate-500">Invoice date</dt><dd className="font-semibold">{dateValue(invoice.invoice_date)}</dd><dt className="text-slate-500">Due date</dt><dd className="font-semibold">{dateValue(invoice.due_date) || '—'}</dd><dt className="text-slate-500">Status</dt><dd className="font-semibold uppercase">{invoice.payment_state || invoice.state}</dd></dl>
    </div>
    <table className="w-full border-collapse text-sm"><thead><tr className="bg-[#6f0d18] text-white"><th className="p-3 text-left">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit price</th><th className="p-3 text-right">Discount</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{(invoice.customer_invoice_lines || []).map((line, index) => { const amount = Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount_percent || 0) / 100); return <tr key={line.id || index} className="border-b"><td className="p-3">{line.description}</td><td className="p-3 text-right">{Number(line.quantity)}</td><td className="p-3 text-right">{money(line.unit_price)}</td><td className="p-3 text-right">{Number(line.discount_percent || 0).toFixed(2)}%</td><td className="p-3 text-right font-medium">{money(amount)}</td></tr>; })}</tbody></table>
    <div className="ml-auto mt-7 w-72 text-sm"><Total label="Subtotal" value={Number(invoice.amount_untaxed)} /><Total label="Tax" value={Number(invoice.amount_tax)} /><div className="my-2 border-t border-slate-400" /><div className="flex justify-between py-2 text-lg font-bold"><span>Total</span><span>{money(invoice.amount_total, currency)}</span></div><div className="flex justify-between py-1"><span>Paid</span><span>{money(invoice.paid_amount ?? Number(invoice.amount_total) - Number(invoice.amount_due), currency)}</span></div><div className="flex justify-between py-1"><span>Balance due</span><span>{money(invoice.amount_due, currency)}</span></div></div>
  </section>;
}

function Select({ label, value, set, rows, labelKey = 'name', optional, account, disabled }: { label: string; value: string; set: (value: string) => void; rows: Row[]; labelKey?: string; optional?: boolean; account?: boolean; disabled?: boolean }) {
  return <label className="text-xs font-semibold">{label}{!optional && <span className="text-rose-500"> *</span>}<select disabled={disabled} required={!optional} value={value} onChange={(event) => set(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted"><option value="">Select {label.toLowerCase()}</option>{rows.map((row) => <option key={row.id} value={row.id}>{account ? `${String(row.code || '')} — ${String(row.name || '')}` : String(row[labelKey] || row.name || '')}</option>)}</select></label>;
}
function Field({ label, value, set, type = 'text', optional, disabled }: { label: string; value: string; set: (value: string) => void; type?: string; optional?: boolean; disabled?: boolean }) {
  return <label className="text-xs font-semibold">{label}{!optional && <span className="text-rose-500"> *</span>}<input disabled={disabled} required={!optional} type={type} step={type === 'number' ? '0.000001' : undefined} min={type === 'number' ? '0.000001' : undefined} value={value} onChange={(event) => set(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted" /></label>;
}
function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between py-1 ${strong ? 'text-base font-bold' : ''}`}><span>{label}</span><span>{value.toFixed(2)}</span></div>; }
function Status({ invoice }: { invoice: CustomerInvoice }) {
  const key = invoice.state === 'cancelled' ? 'cancelled' : invoice.payment_state === 'paid' ? 'paid' : invoice.payment_state === 'partial' ? 'partial' : invoice.state;
  const styles: Record<string, string> = { draft: 'bg-zinc-100 text-zinc-700', posted: 'bg-blue-50 text-blue-700', partial: 'bg-orange-50 text-orange-700', paid: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-rose-50 text-rose-700' };
  const labels: Record<string, string> = { draft: 'DRAFT', posted: 'POSTED', partial: 'PARTIALLY PAID', paid: 'PAID', cancelled: 'CANCELLED' };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[key] || styles.draft}`}>{labels[key] || key.toUpperCase()}</span>;
}
