'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Edit3, Landmark, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { bankAccountApi } from '@/lib/api/accounting/banking/bankAccountApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import { actionBtnDelete, actionBtnEdit, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type AccountForm = { company_id: string; institution_name: string; account_name: string; account_number: string; iban: string; currency_id: string; gl_account_id: string; is_active: boolean };

const emptyAccount = (): AccountForm => ({ company_id: '', institution_name: '', account_name: '', account_number: '', iban: '', currency_id: '', gl_account_id: '', is_active: true });
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';
const dash = '-';

export default function BankingSetupPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [form, setForm] = useState<AccountForm>(emptyAccount);
  const [selected, setSelected] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, companyRows, currencyRows, accountRows] = await Promise.all([
        bankAccountApi.getAll(), companyApi.getAll(), currencyApi.getAll(), bankAccountApi.getEligibleGlAccounts(),
      ]);
      setRows(data); setCompanies(companyRows); setCurrencies(currencyRows); setAccounts(accountRows);
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const needle = query.trim().toLowerCase();
    return (!needle || Object.values(row).some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (status === 'all' || Boolean(row.is_active) === (status === 'active')) &&
      (companyFilter === 'all' || Number(row.company_id) === Number(companyFilter));
  }), [companyFilter, query, rows, status]);
  const companyAccounts = accounts.filter((row) => Number(row.company_id) === Number(form.company_id));

  function create() { setSelected(null); setForm(emptyAccount()); setOpen(true); }
  function edit(row: Row) {
    setSelected(row);
    setForm({
      company_id: String(row.company_id || ''),
      institution_name: String(row.institution_name || (row.banks as Row | undefined)?.name || ''),
      account_name: String(row.account_name || ''),
      account_number: String(row.account_number || ''),
      iban: String(row.iban || ''),
      currency_id: String(row.currency_id || ''),
      gl_account_id: String(row.gl_account_id || ''),
      is_active: row.is_active !== false,
    });
    setOpen(true);
  }
  function selectCompany(value: string) {
    const company = companies.find((row) => row.id === Number(value));
    setForm((current) => ({ ...current, company_id: value, currency_id: String(company?.currency_id || ''), gl_account_id: '' }));
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    const payload = {
      ...form,
      company_id: Number(form.company_id),
      currency_id: Number(form.currency_id),
      gl_account_id: form.gl_account_id ? Number(form.gl_account_id) : null,
    };
    try {
      if (selected) await bankAccountApi.update(selected.id, payload); else await bankAccountApi.create(payload);
      showToast(`Bank account ${selected ? 'updated' : 'created'} successfully`, 'success'); setOpen(false); await load();
    } catch (error) { showToast(errorMessage(error), 'error'); } finally { setSaving(false); }
  }
  async function remove(row: Row) {
    setSaving(true); try { await bankAccountApi.remove(row.id); showToast('Bank account deleted', 'success'); setDeleteTarget(null); await load(); } catch (error) { showToast(errorMessage(error), 'error'); } finally { setSaving(false); }
  }

  const columns: DashboardTableColumn<Row>[] = [
    { key: 'name', header: 'Account Name', cell: (row) => <span className="font-semibold">{String(row.account_name)}</span> },
    { key: 'institution', header: 'Institution', cell: (row) => String(row.institution_name || (row.banks as Row | undefined)?.name || dash) },
    { key: 'number', header: 'Account Number', cell: (row) => <span className="font-mono">{String(row.account_number || dash)}</span> },
    { key: 'company', header: 'Company', cell: (row) => String(companies.find((company) => company.id === Number(row.company_id))?.name || dash) },
    { key: 'currency', header: 'Currency', cell: (row) => String(currencies.find((currency) => currency.id === Number(row.currency_id))?.code || dash) },
    { key: 'gl', header: 'GL Account', cell: (row) => { const account = accounts.find((item) => item.id === Number(row.gl_account_id)); return account ? `${String(account.code)} - ${String(account.name)}` : dash; } },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <Status active={row.is_active !== false} /> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <Actions edit={() => edit(row)} remove={() => setDeleteTarget(row)} /> },
  ];

  return <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
    <div className={pageHeaderWrapperClass}><div className="flex items-center gap-2 text-primary"><Landmark className="size-4" /><span className="text-xs font-bold uppercase tracking-[.2em]">Banking</span></div><h1 className={pageHeaderTitleClass}>Bank Accounts</h1><p className="mt-1 text-sm text-muted-foreground">Manage payment institutions, account details, and ledger links in one place.</p></div>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search bank accounts..." emptyText="No bank accounts found" minWidth="1000px" action={<button onClick={create} className={btnCreatePage}><Plus className="size-4" /> Add account</button>} filters={<><select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All companies</option>{companies.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />
    <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{selected ? 'Edit' : 'Add'} bank account</DialogTitle><DialogDescription>Configure the institution and accounting connection for this account.</DialogDescription></DialogHeader><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Select label="Company" value={form.company_id} set={selectCompany} rows={companies} />
      <Field label="Institution name" value={form.institution_name} set={(value) => setForm({ ...form, institution_name: value })} />
      <Field label="Account name" value={form.account_name} set={(value) => setForm({ ...form, account_name: value })} />
      <Field label="Account number" value={form.account_number} set={(value) => setForm({ ...form, account_number: value })} optional />
      <Field label="IBAN" value={form.iban} set={(value) => setForm({ ...form, iban: value })} optional />
      <Select label="Currency" value={form.currency_id} set={(value) => setForm({ ...form, currency_id: value })} rows={currencies.filter((row) => row.is_active !== false)} labelKey="code" />
      <Select label="GL account" value={form.gl_account_id} set={(value) => setForm({ ...form, gl_account_id: value })} rows={companyAccounts} account />
      <Toggle label="Active account" checked={form.is_active} set={(value) => setForm({ ...form, is_active: value })} />
      <DialogFooter className="sm:col-span-2"><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border px-5">Cancel</button><button disabled={saving} className="h-10 rounded-xl bg-primary px-5 font-semibold text-white">{saving ? 'Saving...' : 'Save'}</button></DialogFooter>
    </form></DialogContent></Dialog>
    <AccountingConfirmDialog open={Boolean(deleteTarget)} title="Delete Bank Account" description="Confirm removal of this bank account record." confirmLabel="Delete Account" destructive busy={saving} details={deleteTarget && <div className="flex justify-between"><span className="text-muted-foreground">Name</span><b>{String(deleteTarget.account_name)}</b></div>} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && void remove(deleteTarget)} />
  </main>;
}

function Status({ active }: { active: boolean }) { return <span className={`${dashboardStatusBadgeClass} ${active ? 'bg-emerald-600 text-white' : 'bg-zinc-500 text-white'}`}>{active ? 'Active' : 'Inactive'}</span>; }
function Actions({ edit, remove }: { edit: () => void; remove: () => void }) { return <div className="flex justify-end gap-1"><button onClick={edit} className={actionBtnEdit}><Edit3 className="size-4" /></button><button onClick={remove} className={actionBtnDelete}><Trash2 className="size-4" /></button></div>; }
function Field({ label, value, set, optional }: { label: string; value: string; set: (value: string) => void; optional?: boolean }) { return <label className="text-xs font-semibold">{label}{!optional && ' *'}<input required={!optional} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3" /></label>; }
function Select({ label, value, set, rows, labelKey = 'name', account, optional }: { label: string; value: string; set: (value: string) => void; rows: Row[]; labelKey?: string; account?: boolean; optional?: boolean }) { return <label className="text-xs font-semibold">{label}{!optional && ' *'}<select required={!optional} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3"><option value="">Select {label.toLowerCase()}</option>{rows.map((row) => <option key={row.id} value={row.id}>{account ? `${String(row.code || '')} - ${String(row.name || '')}` : String(row[labelKey] || row.name || '')}</option>)}</select></label>; }
function Toggle({ label, checked, set }: { label: string; checked: boolean; set: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} className="size-4 accent-primary" />{label}</label>; }
