'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Edit3, Eye, Plus, Printer, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { vendorBillApi, vendorRefundApi, type VendorBill, type VendorBillLine } from '@/lib/api/accounting/payables/vendorBillApi';
import { vendorApi } from '@/lib/api/accounting/payables/vendorApi';
import { vendorPaymentApi } from '@/lib/api/accounting/payables/vendorPaymentApi';
import { accountingProductApi } from '@/lib/api/accounting/catalog/productApi';
import { accountingTaxApi } from '@/lib/api/accounting/configuration/taxApi';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';
import { paymentTermApi } from '@/lib/api/accounting/configuration/paymentTermApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { bankAccountApi } from '@/lib/api/accounting/banking/bankAccountApi';
import { chartOfAccountApi } from '@/lib/api/accounting/ledger/chartOfAccountApi';
import { accountTypeApi } from '@/lib/api/accounting/configuration/accountTypeApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Line = Omit<VendorBillLine, 'id' | 'subtotal'>;
type Form = {
  vendor_id: string; reversed_bill_id: string; bill_date: string; received_date: string; currency_id: string; exchange_rate: string;
  payment_term_id: string; vendor_reference: string; notes: string; lines: Line[]; pay_vendor_now: boolean;
  payment_method_id: string; bank_account_id: string; amount_paid: string; payment_reference: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ line_type: 'product', product_id: null, expense_account_id: null, description: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null, amount: 0 });
const emptyForm = (): Form => ({ vendor_id: '', reversed_bill_id: '', bill_date: today(), received_date: today(), currency_id: '', exchange_rate: '1', payment_term_id: '', vendor_reference: '', notes: '', lines: [emptyLine()], pay_vendor_now: false, payment_method_id: '', bank_account_id: '', amount_paid: '', payment_reference: '' });
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const apiDate = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString();
const money = (value: unknown) => Number(value || 0).toFixed(2);
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

export default function VendorBillsPage({ kind = 'bill' }: { kind?: 'bill' | 'refund' }) {
  const isRefund = kind === 'refund';
  const recordsApi = isRefund ? vendorRefundApi : vendorBillApi;
  const { showToast } = useToast();
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [sourceBills, setSourceBills] = useState<VendorBill[]>([]);
  const [vendors, setVendors] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [taxes, setTaxes] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [terms, setTerms] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Row[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [accountTypes, setAccountTypes] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<VendorBill | null>(null);
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [availableAdvance, setAvailableAdvance] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [refundReason, setRefundReason] = useState('');
  const [moreNotes, setMoreNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete'; bill: VendorBill } | null>(null);
  const [printTarget, setPrintTarget] = useState<VendorBill | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billRows, sourceRows, vendorRows, productRows, taxRows, currencyRows, termRows, companyRows, methodRows, bankRows, accountRows, accountTypeRows] = await Promise.all([
        recordsApi.getAll(), isRefund ? vendorBillApi.getAll() : Promise.resolve([]), vendorApi.getAll(), accountingProductApi.getAll(), accountingTaxApi.getAll(),
        currencyApi.getAll(), paymentTermApi.getAll(), companyApi.getAll(), accountingPaymentMethodApi.getAll(), bankAccountApi.getAll(), chartOfAccountApi.getAll(), accountTypeApi.getAll(),
      ]);
      setBills(billRows); setSourceBills(sourceRows); setVendors(vendorRows); setProducts(productRows); setTaxes(taxRows);
      setCurrencies(currencyRows); setTerms(termRows); setCompanies(companyRows); setPaymentMethods(methodRows); setBankAccounts(bankRows);
      setAccounts(accountRows); setAccountTypes(accountTypeRows);
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setLoading(false); }
  }, [showToast, recordsApi, isRefund]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const totals = useMemo(() => form.lines.reduce((sum, line) => {
    const gross = line.line_type === 'expense' ? Number(line.amount) : Number(line.quantity) * Number(line.unit_price);
    const discounted = gross * (1 - Number(line.discount_percent) / 100);
    const tax = taxes.find((row) => row.id === Number(line.tax_id));
    const rate = Number(tax?.rate_percent || 0) / 100;
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted;
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0;
    return { subtotal: sum.subtotal + untaxed, tax: sum.tax + taxAmount, total: sum.total + untaxed + taxAmount };
  }, { subtotal: 0, tax: 0, total: 0 }), [form.lines, taxes]);
  const selectedVendor = vendors.find((row) => row.id === Number(form.vendor_id));
  const expenseAccountTypeIds = useMemo(() => new Set(accountTypes.filter((type) => type.internal_group === 'expense').map((type) => Number(type.id))), [accountTypes]);
  // Posting accounts can be children of an expense heading (for example,
  // 5000 Expenses → 5002 Rent).  A valid account is therefore a leaf account,
  // not necessarily one without a parent.
  const expenseAccounts = accounts.filter((account) => Number(account.company_id) === Number(selectedVendor?.company_id) && account.is_active !== false && account.allow_manual_entry !== false && expenseAccountTypeIds.has(Number(account.account_type_id)) && !accounts.some((child) => Number(child.parent_id) === Number(account.id)));
  const selectedPaymentMethod = paymentMethods.find((row) => row.id === Number(form.payment_method_id));
  const availableBankAccounts = bankAccounts.filter((row) => Number(row.company_id) === Number(selectedVendor?.company_id) && Number(row.currency_id) === Number(form.currency_id) && row.is_active !== false && row.gl_account_id);
  const paymentNow = form.pay_vendor_now ? Math.max(0, Number(form.amount_paid) || 0) : 0;
  const summaryPaid = viewOnly && selected ? Number(selected.amount_paid || 0) : paymentNow + Math.min(advanceAmount, totals.total);
  const summaryBalance = Math.max(0, totals.total - summaryPaid);
  const summaryStatus = summaryPaid <= 0.005 ? 'Posted' : summaryBalance <= 0.005 ? 'Paid' : 'Partially Paid';
  const filtered = bills.filter((bill) => {
    const needle = query.trim().toLowerCase();
    return (!needle || [bill.bill_number, bill.vendor_reference, bill.vendors?.name, bill.state].some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (vendorFilter === 'all' || bill.vendor_id === Number(vendorFilter)) &&
      (statusFilter === 'all' || bill.state === statusFilter);
  });

  function prepareBill() {
    const next = emptyForm();
    if (currencies.length === 1) next.currency_id = String(currencies[0].id);
    const immediate = terms.find((row) => /immediate/i.test(String(row.name)));
    if (immediate) next.payment_term_id = String(immediate.id);
    setSelected(null); setViewOnly(false); setAvailableAdvance(0); setAdvanceAmount(0); setRefundMode('full'); setRefundReason(''); setMoreNotes(''); setForm(next); setOpen(true);
  }
  function openBill(bill: VendorBill, readonly = false) {
    setSelected(bill); setViewOnly(readonly || bill.state !== 'draft');
    setForm({
      vendor_id: String(bill.vendor_id), reversed_bill_id: String(bill.reversed_bill_id || ''), bill_date: dateValue(bill.bill_date), received_date: dateValue(bill.received_date),
      currency_id: String(bill.currency_id || ''), exchange_rate: String(bill.exchange_rate || 1),
      payment_term_id: String(bill.payment_term_id || ''), vendor_reference: String(bill.vendor_reference || ''),
      notes: '', pay_vendor_now: false, payment_method_id: '', bank_account_id: '', amount_paid: '', payment_reference: '', lines: (bill.vendor_bill_lines || []).map((line) => ({
        product_id: line.product_id || null, description: line.description, quantity: Number(line.quantity),
        unit_price: Number(line.unit_price), discount_percent: Number(line.discount_percent),
        tax_id: line.tax_id || null, line_type: (line.product_id ? 'product' : 'expense') as 'product' | 'expense', expense_account_id: line.expense_account_id || null, amount: Number(line.unit_price),
      })),
    });
    if (isRefund) { setRefundMode('partial'); setRefundReason(''); setMoreNotes(String(bill.notes || '')); }
    if (!isRefund) void loadVendorAdvance(bill.vendor_id, bill.currency_id);
    setOpen(true);
  }
  async function loadVendorAdvance(vendorId: number, currencyId: number) {
    if (!vendorId || !currencyId) { setAvailableAdvance(0); setAdvanceAmount(0); return; }
    try { const result = await vendorPaymentApi.getAdvances(vendorId, currencyId); setAvailableAdvance(result.balance); setAdvanceAmount(0); }
    catch { setAvailableAdvance(0); setAdvanceAmount(0); }
  }
  function selectVendor(value: string) {
    const nextVendor = vendors.find((row) => row.id === Number(value));
    const nextCompany = companies.find((row) => row.id === Number(nextVendor?.company_id));
    setForm((current) => ({
      ...current, vendor_id: value, currency_id: String(nextVendor?.currency_id || nextCompany?.currency_id || current.currency_id),
      payment_term_id: String(nextVendor?.payment_term_id || current.payment_term_id), exchange_rate: '1',
      ...(isRefund ? { reversed_bill_id: '', payment_term_id: '' } : {}),
      lines: isRefund ? [emptyLine()] : current.lines,
    }));
    if (isRefund) { setRefundMode('full'); setRefundReason(''); setMoreNotes(''); }
    if (!isRefund) void loadVendorAdvance(Number(value), Number(nextVendor?.currency_id || nextCompany?.currency_id || 0));
  }
  function selectOriginalBill(value: string) {
    const original = sourceBills.find((row) => row.id === Number(value));
    if (!original) { setForm((current) => ({ ...current, reversed_bill_id: value })); return; }
    const lines = (original.vendor_bill_lines || []).map((line) => ({
      product_id: line.product_id || null, description: line.description, quantity: Number(line.quantity), unit_price: Number(line.unit_price),
      discount_percent: Number(line.discount_percent), tax_id: line.tax_id || null, line_type: (line.product_id ? 'product' : 'expense') as 'product' | 'expense', expense_account_id: line.expense_account_id || null, amount: Number(line.unit_price),
    }));
    setForm((current) => ({ ...current, vendor_id: String(original.vendor_id), reversed_bill_id: value, currency_id: String(original.currency_id), exchange_rate: String(original.exchange_rate || 1), payment_term_id: '', bill_date: today(), received_date: today(), lines }));
    setRefundMode('full'); setRefundReason(''); setMoreNotes('');
  }
  function updateLine(index: number, patch: Partial<Line>) {
    setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }));
  }
  function chooseProduct(index: number, value: string) {
    const product = products.find((row) => row.id === Number(value));
    updateLine(index, product ? {
      product_id: product.id, description: String(product.name), unit_price: Number(product.standard_cost || 0),
      tax_id: Number(product.purchase_tax_id) || null,
    } : { product_id: null });
  }
  async function save(postAfterSave = false) {
    setSaving(true);
    const { pay_vendor_now: _payNow, payment_method_id: _paymentMethod, bank_account_id: _bankAccount, amount_paid: _amountPaid, payment_reference: _paymentReference, ...billForm } = form;
    const payload = {
      ...billForm, notes: isRefund ? [`Refund reason: ${refundReason.trim()}`, moreNotes.trim()].filter(Boolean).join('\n') : form.notes,
      lines: form.lines.map((line) => ({ ...line, ...(isRefund ? { line_type: undefined } : {}), description: line.description || String(products.find((product) => product.id === Number(line.product_id))?.name || 'Expense') })), vendor_id: Number(form.vendor_id), bill_date: apiDate(form.bill_date),
      received_date: form.received_date ? apiDate(form.received_date) : null, currency_id: Number(form.currency_id),
      exchange_rate: Number(form.exchange_rate), payment_term_id: form.payment_term_id ? Number(form.payment_term_id) : null,
      reversed_bill_id: form.reversed_bill_id ? Number(form.reversed_bill_id) : null,
    };
    try {
      const saved = selected ? await recordsApi.update(selected.id, payload) : await recordsApi.create(payload);
      if (postAfterSave) {
        if (isRefund) await vendorRefundApi.post(saved.id); else await vendorBillApi.post(saved.id, {
          advance_amount: Math.min(advanceAmount, totals.total), pay_vendor_now: form.pay_vendor_now,
          payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
          bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : undefined,
          amount_paid: form.pay_vendor_now ? Number(form.amount_paid) : undefined,
          payment_reference: form.payment_reference,
        });
      }
      showToast(postAfterSave ? `Vendor ${kind} posted successfully` : `Draft vendor ${kind} ${selected ? 'updated' : 'prepared'} successfully`, 'success');
      setOpen(false); await load();
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setSaving(false); }
  }
  async function remove(bill: VendorBill) {
    setSaving(true); try { await recordsApi.remove(bill.id); showToast(`Draft vendor ${kind} deleted`, 'success'); setPendingAction(null); await load(); }
    catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  async function postRecord(bill: VendorBill) {
    setSaving(true); try { await recordsApi.post(bill.id, isRefund ? undefined : {}); showToast(`Vendor ${kind} posted successfully`, 'success'); setPendingAction(null); await load(); }
    catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  async function printRecord(bill: VendorBill) {
    try { const fullRecord = await recordsApi.getById(bill.id); setPrintTarget(fullRecord); window.setTimeout(() => window.print(), 100); }
    catch (error) { showToast(errorMessage(error), 'error'); }
  }

  const columns: DashboardTableColumn<VendorBill>[] = [
    { key: 'number', header: 'Bill', cell: (row) => <span className="font-bold text-primary">{row.bill_number}</span> },
    { key: 'vendor', header: 'Vendor', cell: (row) => row.vendors?.name || `#${row.vendor_id}` },
    { key: 'reference', header: 'Vendor Reference', cell: (row) => String(row.vendor_reference || '—') },
    { key: 'date', header: 'Bill Date', cell: (row) => dateValue(row.bill_date) },
    { key: 'due', header: 'Due Date', cell: (row) => dateValue(row.due_date) },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <Status bill={row} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (row) => <span className="font-semibold">{row.currencies?.code} {money(row.amount_total)}</span> },
    { key: 'paidAmount', header: 'Paid', align: 'right', cell: (row) => money(row.amount_paid) },
    { key: 'dueAmount', header: 'Balance', align: 'right', cell: (row) => <span className="font-semibold">{money(row.amount_due)}</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1">
      {row.state === 'draft' ? <><button title="Edit" onClick={() => openBill(row)} className={actionBtnEdit}><Edit3 className="size-4" /></button><button title="Post" onClick={() => setPendingAction({ type: 'post', bill: row })} className={actionBtnView}><Send className="size-4" /></button><button title="Delete" onClick={() => setPendingAction({ type: 'delete', bill: row })} className={actionBtnDelete}><Trash2 className="size-4" /></button></> : <><button title="View" onClick={() => openBill(row, true)} className={actionBtnView}><Eye className="size-4" /></button><button title="Print" onClick={() => void printRecord(row)} className={actionBtnView}><Printer className="size-4" /></button></>}
    </div> },
  ];

  return <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
    <div className={pageHeaderWrapperClass}><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Payables</p><h1 className={pageHeaderTitleClass}>{isRefund ? 'Vendor Refunds' : 'Vendor Bills'}</h1><p className="mt-1 text-sm text-muted-foreground">{isRefund ? 'Record vendor credits and refunds against posted bills.' : 'Prepare and manage bills received from your vendors.'}</p></div>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search vendor ${isRefund ? 'refunds' : 'bills'}...`} emptyText={`No vendor ${isRefund ? 'refunds' : 'bills'} found`} minWidth="1100px" action={<button onClick={prepareBill} className={btnCreatePage}><Plus className="size-4" /> Prepare {isRefund ? 'refund' : 'bill'}</button>} filters={<>
      <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All vendors</option>{vendors.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select>
      <button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
    </>} />
    <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}><DialogContent className="max-h-[94vh] max-w-[calc(100vw-2rem)] overflow-y-auto xl:max-w-[1400px]"><DialogHeader><DialogTitle>{viewOnly ? 'View' : selected ? 'Edit' : 'Prepare'} vendor {kind}</DialogTitle><DialogDescription>{viewOnly ? `This ${kind} is read-only.` : 'Bill number, company, currency, and exchange rate are applied automatically.'}</DialogDescription></DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4"><fieldset disabled={viewOnly} className="contents">
        <div className={`grid gap-x-4 gap-y-3 sm:grid-cols-2 ${isRefund ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          <Select label="Vendor" value={form.vendor_id} set={selectVendor} rows={vendors} />
          {isRefund ? <><Select label="Original bill" value={form.reversed_bill_id} set={selectOriginalBill} rows={sourceBills.filter((row) => row.vendor_id === Number(form.vendor_id) && row.state === 'posted')} labelKey="bill_number" /><Field label="Refund date" type="date" value={form.bill_date} set={(value) => setForm({ ...form, bill_date: value, received_date: value })} /></> : <><Field label="Bill date" type="date" value={form.bill_date} set={(value) => setForm({ ...form, bill_date: value })} /><Field label="Received date" type="date" value={form.received_date} set={(value) => setForm({ ...form, received_date: value })} /><Select label="Payment term" value={form.payment_term_id} set={(value) => setForm({ ...form, payment_term_id: value })} rows={terms} optional /></>}
        </div>
        {isRefund && form.reversed_bill_id && <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[220px_1fr]"><label className="text-xs font-semibold">Refund Type *<select value={refundMode} onChange={(event) => setRefundMode(event.target.value as 'full' | 'partial')} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3"><option value="full">Full Refund</option><option value="partial">Partial Refund</option></select></label><label className="text-xs font-semibold">Refund Reason *<input required value={refundReason} onChange={(event) => setRefundReason(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3" placeholder="Reason for this refund" /></label>{refundMode === 'full' && <label className="text-xs font-semibold sm:col-span-2">Refund Amount<input readOnly value={money(totals.total)} className="mt-1.5 h-10 w-full rounded-xl border bg-muted px-3 font-semibold" /></label>}</div>}
        {!isRefund && form.vendor_id && availableAdvance > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><div><b>Available Vendor Advance: ${money(availableAdvance)}</b><p className="text-xs text-emerald-700">Apply it now to reduce this bill&apos;s outstanding balance after posting.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setAdvanceAmount(Math.min(availableAdvance, totals.total))} className="h-9 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold">Apply All</button><label className="flex items-center gap-2 text-xs font-semibold">Partial<input aria-label="Partial Vendor Advance" type="number" min="0" max={Math.min(availableAdvance, totals.total)} step="0.01" value={advanceAmount} onChange={(event) => setAdvanceAmount(Math.min(Math.max(0, Number(event.target.value) || 0), availableAdvance, totals.total))} className="h-9 w-28 rounded-lg border bg-white px-2 text-right" /></label><button type="button" onClick={() => setAdvanceAmount(0)} className="h-9 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold">Ignore</button></div></div>}
        {(!isRefund || refundMode === 'partial') && <div className="rounded-xl border"><table className="w-full table-fixed text-xs"><colgroup><col className="w-[17%]" /><col className="w-[20%]" /><col className="w-[7%]" /><col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[5%]" /></colgroup><thead className="bg-muted/50"><tr><th className="p-2.5 text-left">Line type / item</th><th className="p-2.5 text-left">Description</th><th className="p-2.5">Qty</th><th className="p-2.5">Unit cost / amount</th><th className="p-2.5">Discount</th><th className="p-2.5">Tax</th><th className="p-2.5 text-right">Line total</th><th /></tr></thead><tbody>{form.lines.map((line, index) => <tr key={index} className="border-t">
          <td className="space-y-1 p-2">{!isRefund && <select value={line.line_type || 'product'} onChange={(event) => updateLine(index, event.target.value === 'expense' ? { line_type: 'expense', product_id: null, discount_percent: 0, quantity: 1, unit_price: 0 } : { line_type: 'product', expense_account_id: null, amount: 0 })} className="h-8 w-full rounded-lg border px-2"><option value="product">Product</option><option value="expense">Expense</option></select>}{line.line_type === 'expense' ? <select required value={line.expense_account_id || ''} onChange={(event) => updateLine(index, { expense_account_id: Number(event.target.value) || null })} className="h-9 w-full rounded-lg border px-2"><option value="">Select expense account</option>{expenseAccounts.map((row) => <option key={row.id} value={row.id}>{String(row.code)} — {String(row.name)}</option>)}</select> : <select required value={line.product_id || ''} onChange={(event) => chooseProduct(index, event.target.value)} className="h-9 w-full rounded-lg border px-2"><option value="">Select product</option>{products.filter((row) => row.can_be_purchased !== false).map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select>}</td>
          <td className="p-2"><input required value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} className="h-9 w-full rounded-lg border px-2" placeholder="Product or service description" /></td>
          <td className="p-2">{line.line_type === 'expense' ? '—' : <input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="h-9 w-full rounded-lg border px-2" />}</td>
          <td className="p-2"><input required type="number" min="0" step="0.01" value={line.line_type === 'expense' ? line.amount || 0 : line.unit_price} onChange={(event) => updateLine(index, line.line_type === 'expense' ? { amount: Number(event.target.value) } : { unit_price: Number(event.target.value) })} className="h-9 w-full rounded-lg border px-2" /></td>
          <td className="p-2">{line.line_type === 'expense' ? '—' : <input type="number" min="0" max="100" step=".01" value={line.discount_percent} onChange={(event) => updateLine(index, { discount_percent: Number(event.target.value) })} className="h-9 w-full rounded-lg border px-2" />}</td>
          <td className="p-2"><select value={line.tax_id || ''} onChange={(event) => updateLine(index, { tax_id: Number(event.target.value) || null })} className="h-9 w-full rounded-lg border px-2"><option value="">No tax</option>{taxes.filter((row) => row.is_active !== false && Number(row.rate_percent || 0) !== 0).map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></td>
          <td className="p-2 text-right font-semibold">{money((line.line_type === 'expense' ? Number(line.amount) : Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount_percent || 0) / 100)))}</td>
          <td className="p-2"><button type="button" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })} className="text-rose-600 disabled:opacity-30"><X className="size-4" /></button></td>
        </tr>)}</tbody></table><button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })} className="m-3 flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-3" /> Add line</button></div>}
        {!isRefund && !viewOnly && <section className="rounded-xl border bg-muted/10 p-4"><h3 className="font-semibold">Payment Information</h3><label className="mt-3 flex w-fit items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.pay_vendor_now} onChange={(event) => setForm((current) => ({ ...current, pay_vendor_now: event.target.checked, payment_method_id: event.target.checked ? current.payment_method_id : '', bank_account_id: '', amount_paid: event.target.checked ? current.amount_paid : '', payment_reference: event.target.checked ? current.payment_reference : '' }))} className="size-4 accent-primary" /> Pay Vendor Now</label>{form.pay_vendor_now && <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Select label="Payment Method" value={form.payment_method_id} set={(value) => setForm((current) => ({ ...current, payment_method_id: value, bank_account_id: '' }))} rows={paymentMethods.filter((row) => row.is_active !== false && ['outbound', 'both'].includes(String(row.payment_type)))} />{selectedPaymentMethod?.allow_multiple_accounts === true && <Select label="Bank Account" value={form.bank_account_id} set={(value) => setForm((current) => ({ ...current, bank_account_id: value }))} rows={availableBankAccounts} labelKey="account_name" optional={availableBankAccounts.length === 1} />}<label className="text-xs font-semibold">Amount Paid <span className="text-rose-500">*</span><input required type="number" min="0.01" max={Math.max(0, totals.total - Math.min(advanceAmount, totals.total))} step="0.01" value={form.amount_paid} onChange={(event) => setForm((current) => ({ ...current, amount_paid: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm" /></label><Field label="Reference" value={form.payment_reference} set={(value) => setForm((current) => ({ ...current, payment_reference: value }))} optional /></div>}</section>}
        <div className="mt-4 grid items-stretch gap-4 lg:min-h-[170px] lg:grid-cols-[minmax(0,1fr)_280px]">{isRefund ? <details className="h-fit rounded-xl border p-4"><summary className="cursor-pointer text-xs font-semibold">More Options</summary><label className="mt-3 flex flex-col text-xs font-semibold">Notes<textarea value={moreNotes} onChange={(event) => setMoreNotes(event.target.value)} className="mt-1 min-h-[100px] w-full resize-none rounded-lg border p-2 text-sm" placeholder="Optional internal notes..." /></label></details> : <label className="flex h-full flex-col text-xs font-semibold">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-[140px] w-full flex-1 resize-none rounded-lg border p-2 text-sm" placeholder="Add any notes for this bill..." /></label>}<aside className="h-full rounded-xl border bg-muted/20 p-4 text-sm"><p className="mb-3 font-semibold">Bill summary</p><Total label="Subtotal" value={totals.subtotal} /><Total label="Tax" value={totals.tax} /><div className="my-2 border-t" /><Total label="Grand total" value={totals.total} strong />{!isRefund && <><div className="my-2 border-t" /><Total label="Paid" value={summaryPaid} /><Total label="Balance" value={summaryBalance} /><div className="mt-2 flex justify-between font-semibold"><span>Status</span><span>{summaryStatus}</span></div></>}</aside></div>
      </fieldset><DialogFooter><button type="button" onClick={() => setOpen(false)} className="h-9 rounded-xl border px-4">{viewOnly ? 'Close' : 'Cancel'}</button>{!viewOnly && <><button disabled={saving} className="h-9 rounded-xl border px-4 font-semibold">{saving ? 'Saving...' : 'Save Draft'}</button><button type="button" disabled={saving} onClick={(event) => { if (event.currentTarget.form?.reportValidity()) void save(true); }} className="h-9 rounded-xl bg-primary px-4 font-semibold text-white">Post {isRefund ? 'Refund' : 'Bill'}</button></>}</DialogFooter></form>
    </DialogContent></Dialog>
    <AccountingConfirmDialog open={Boolean(pendingAction)} title={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Vendor ${isRefund ? 'Refund' : 'Bill'}`} description={pendingAction?.type === 'delete' ? `Confirm removal of this draft vendor ${kind}.` : `Confirm this vendor ${kind} before updating accounting balances.`} confirmLabel={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} ${isRefund ? 'Refund' : 'Bill'}`} destructive={pendingAction?.type === 'delete'} busy={saving} details={pendingAction && <div className="flex justify-between"><span className="text-muted-foreground">Document</span><b>{pendingAction.bill.bill_number}</b></div>} onCancel={() => setPendingAction(null)} onConfirm={() => pendingAction && void (pendingAction.type === 'delete' ? remove(pendingAction.bill) : postRecord(pendingAction.bill))} />
    {printTarget && <PrintableVendorDocument record={printTarget} refund={isRefund} />}
  </main>;
}

function PrintableVendorDocument({ record, refund }: { record: VendorBill; refund: boolean }) {
  const currency = record.currencies?.code || '';
  return <section id="printable-vendor-document" className="hidden bg-white text-slate-950 print:block"><header className="flex items-start justify-between border-b-2 border-slate-900 pb-6"><div><h1 className="text-3xl font-bold text-[#6f0d18]">Ruut Caffe</h1><p className="mt-1 text-sm text-slate-500">{refund ? 'Vendor refund' : 'Vendor bill'}</p></div><div className="text-right"><h2 className="text-3xl font-semibold">{refund ? 'VENDOR REFUND' : 'VENDOR BILL'}</h2><p className="mt-2 font-bold">{record.bill_number}</p></div></header><div className="grid grid-cols-2 gap-10 py-7 text-sm"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vendor</p><p className="mt-2 text-base font-bold">{record.vendors?.name || `Vendor #${record.vendor_id}`}</p>{record.vendors?.phone && <p>{record.vendors.phone}</p>}{record.vendors?.email && <p>{record.vendors.email}</p>}</div><dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-right"><dt className="text-slate-500">{refund ? 'Refund date' : 'Bill date'}</dt><dd className="font-semibold">{dateValue(record.bill_date)}</dd>{!refund && <><dt className="text-slate-500">Due date</dt><dd className="font-semibold">{dateValue(record.due_date) || '—'}</dd></>}<dt className="text-slate-500">Status</dt><dd className="font-semibold uppercase">{record.state}</dd></dl></div><table className="w-full border-collapse text-sm"><thead><tr className="bg-[#6f0d18] text-white"><th className="p-3 text-left">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Discount</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{(record.vendor_bill_lines || []).map((line, index) => { const amount = Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount_percent || 0) / 100); return <tr key={line.id || index} className="border-b"><td className="p-3">{line.description}</td><td className="p-3 text-right">{Number(line.quantity)}</td><td className="p-3 text-right">{money(line.unit_price)}</td><td className="p-3 text-right">{Number(line.discount_percent || 0).toFixed(2)}%</td><td className="p-3 text-right font-medium">{money(amount)}</td></tr>; })}</tbody></table><div className="ml-auto mt-7 w-72 text-sm"><div className="flex justify-between py-1"><span>Subtotal</span><span>{money(record.amount_untaxed)}</span></div><div className="flex justify-between py-1"><span>Tax</span><span>{money(record.amount_tax)}</span></div><div className="my-2 border-t border-slate-400" /><div className="flex justify-between py-2 text-lg font-bold"><span>Total</span><span>{currency} {money(record.amount_total)}</span></div></div></section>;
}

function Select({ label, value, set, rows, labelKey = 'name', optional }: { label: string; value: string; set: (value: string) => void; rows: Row[]; labelKey?: string; optional?: boolean }) {
  return <label className="text-xs font-semibold">{label}{!optional && <span className="text-rose-500"> *</span>}<select required={!optional} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm"><option value="">Select {label.toLowerCase()}</option>{rows.map((row) => <option key={row.id} value={row.id}>{String(row[labelKey] || row.name || '')}</option>)}</select></label>;
}
function Field({ label, value, set, type = 'text', optional, disabled }: { label: string; value: string; set: (value: string) => void; type?: string; optional?: boolean; disabled?: boolean }) {
  return <label className="text-xs font-semibold">{label}{!optional && <span className="text-rose-500"> *</span>}<input disabled={disabled} required={!optional} type={type} step={type === 'number' ? '.000001' : undefined} min={type === 'number' ? '.000001' : undefined} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm disabled:bg-muted" /></label>;
}
function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between py-1 ${strong ? 'text-base font-bold' : ''}`}><span>{label}</span><span>{money(value)}</span></div>; }
function Status({ bill }: { bill: VendorBill }) {
  const key = bill.state === 'cancelled' ? 'cancelled' : bill.payment_state === 'paid' ? 'paid' : bill.payment_state === 'partial' ? 'partial' : bill.state;
  const styles: Record<string, string> = { draft: 'bg-zinc-100 text-zinc-700', posted: 'bg-blue-50 text-blue-700', partial: 'bg-orange-50 text-orange-700', paid: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-rose-50 text-rose-700' };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[key] || styles.draft}`}>{key.replace('_', ' ').toUpperCase()}</span>;
}
