'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BookOpen, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Edit3, Plus, RefreshCw, Search, Trash2, WalletCards } from 'lucide-react';
import { chartOfAccountApi } from '@/lib/api/accounting/ledger/chartOfAccountApi';
import { accountTypeApi } from '@/lib/api/accounting/configuration/accountTypeApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import { actionBtnDelete, actionBtnEdit, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass } from '@/lib/dashboard-ui';

type RecordRow = { id: number; [key: string]: unknown };
type FormState = {
  company_id: string; code: string; name: string; account_type_id: string; parent_id: string;
  currency_id: string; is_reconcilable: boolean; allow_manual_entry: boolean; is_active: boolean; notes: string;
};

const emptyForm: FormState = {
  company_id: '', code: '', name: '', account_type_id: '', parent_id: '', currency_id: '',
  is_reconcilable: false, allow_manual_entry: true, is_active: true, notes: '',
};

function apiError(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Something went wrong';
}

function humanize(value: unknown) {
  return String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ChartOfAccountsPage() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<RecordRow[]>([]);
  const [accountTypes, setAccountTypes] = useState<RecordRow[]>([]);
  const [companies, setCompanies] = useState<RecordRow[]>([]);
  const [currencies, setCurrencies] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [codeFilter, setCodeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountRows, types, companyRows, currencyRows] = await Promise.all([
        chartOfAccountApi.getAll(), accountTypeApi.getAll(), companyApi.getAll(), currencyApi.getAll(),
      ]);
      setAccounts(accountRows); setAccountTypes(types); setCompanies(companyRows); setCurrencies(currencyRows);
    } catch (error) { showToast(apiError(error), 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const typeMap = useMemo(() => new Map(accountTypes.map((row) => [row.id, row])), [accountTypes]);
  const companyMap = useMemo(() => new Map(companies.map((row) => [row.id, row])), [companies]);
  const accountMap = useMemo(() => new Map(accounts.map((row) => [row.id, row])), [accounts]);

  const filtered = useMemo(() => accounts
    .filter((account) => codeFilter === 'all' || String(account.code).startsWith(codeFilter))
    .filter((account) => companyFilter === 'all' || String(account.company_id) === companyFilter)
    .filter((account) => typeFilter === 'all' || String(account.account_type_id) === typeFilter)
    .filter((account) => statusFilter === 'all' || Boolean(account.is_active) === (statusFilter === 'active'))
    .filter((account) => {
      const search = query.trim().toLowerCase();
      if (!search) return true;
      const type = typeMap.get(Number(account.account_type_id));
      return [account.code, account.name, account.notes, type?.name].some((value) => String(value ?? '').toLowerCase().includes(search));
    })
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true })),
  [accounts, codeFilter, companyFilter, query, statusFilter, typeFilter, typeMap]);

  const summary = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter((row) => row.is_active).length,
    posting: accounts.filter((row) => row.allow_manual_entry).length,
    reconcilable: accounts.filter((row) => row.is_reconcilable).length,
  }), [accounts]);

  function createAccount() {
    setSelected(null);
    setForm({ ...emptyForm, company_id: companyFilter !== 'all' ? companyFilter : companies.length === 1 ? String(companies[0].id) : '' });
    setFormOpen(true);
  }

  function editAccount(account: RecordRow) {
    setSelected(account);
    setForm({
      company_id: String(account.company_id ?? ''), code: String(account.code ?? ''), name: String(account.name ?? ''),
      account_type_id: String(account.account_type_id ?? ''), parent_id: String(account.parent_id ?? ''), currency_id: String(account.currency_id ?? ''),
      is_reconcilable: Boolean(account.is_reconcilable), allow_manual_entry: Boolean(account.allow_manual_entry),
      is_active: Boolean(account.is_active), notes: String(account.notes ?? ''),
    });
    setFormOpen(true);
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    const payload = {
      company_id: Number(form.company_id), code: form.code.trim(), name: form.name.trim(), account_type_id: Number(form.account_type_id),
      parent_id: form.parent_id ? Number(form.parent_id) : null, currency_id: form.currency_id ? Number(form.currency_id) : null,
      is_reconcilable: form.is_reconcilable, allow_manual_entry: form.allow_manual_entry, is_active: form.is_active,
      notes: form.notes.trim() || null,
    };
    try {
      if (selected) await chartOfAccountApi.update(selected.id, payload); else await chartOfAccountApi.create(payload);
      showToast(`Account ${selected ? 'updated' : 'created'} successfully`); setFormOpen(false); await loadData();
    } catch (error) { showToast(apiError(error), 'error'); }
    finally { setSaving(false); }
  }

  async function deleteAccount() {
    if (!selected) return; setSaving(true);
    try {
      await chartOfAccountApi.remove(selected.id); showToast('Account deleted successfully'); setDeleteOpen(false); setSelected(null); await loadData();
    } catch (error) { showToast(apiError(error), 'error'); }
    finally { setSaving(false); }
  }

  const eligibleParents = accounts.filter((account) =>
    account.id !== selected?.id
    && String(account.company_id) === form.company_id
    && String(account.account_type_id) === form.account_type_id
  );
  const columns: DashboardTableColumn<RecordRow>[] = [
    { key: 'select', header: <input type="checkbox" aria-label="Select all accounts" checked={filtered.length > 0 && filtered.every((account) => selectedIds.has(account.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(filtered.map((account) => account.id)) : new Set())} className="size-4 accent-primary" />, cell: (account) => <input type="checkbox" aria-label={`Select ${String(account.name)}`} checked={selectedIds.has(account.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(account.id); else next.delete(account.id); return next; })} className="size-4 accent-primary" /> },
    { key: 'code', header: 'Code', cell: (account) => <span className="font-mono font-bold text-primary">{String(account.code)}</span> },
    { key: 'name', header: 'Name', cell: (account) => { const parent = accountMap.get(Number(account.parent_id)); return <div className="flex items-center gap-2">{parent && <ChevronRight className="size-3.5 text-muted-foreground" />}<div><p className="font-medium">{String(account.name)}</p>{parent && <p className="text-[10px] text-muted-foreground">Under {String(parent.name)}</p>}</div></div>; } },
    { key: 'type', header: 'Type', cell: (account) => { const type = typeMap.get(Number(account.account_type_id)); return <div><p className="font-medium">{String(type?.name || 'Unknown')}</p><p className="text-[10px] text-muted-foreground">{humanize(type?.internal_group)}</p></div>; } },
    { key: 'company', header: 'Company', cell: (account) => String(companyMap.get(Number(account.company_id))?.name || '—') },
    { key: 'status', header: 'Status', align: 'center', cell: (account) => <span className={`${dashboardStatusBadgeClass} ${account.is_active ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>{account.is_active ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (account) => <div className="flex justify-end gap-1"><button onClick={() => editAccount(account)} className={actionBtnEdit}><Edit3 className="size-4" /></button><button onClick={() => { setSelected(account); setDeleteOpen(true); }} className={actionBtnDelete}><Trash2 className="size-4" /></button></div> },
  ];

  return (
    <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-primary"><BookOpen className="size-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">General Ledger</span></div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build and maintain the account structure used throughout Ruut Caffe’s books.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total Accounts', summary.total, 'All ledger accounts'], ['Active Accounts', summary.active, 'Available for transactions'],
          ['Posting Accounts', summary.posting, 'Manual entries allowed'], ['Reconcilable', summary.reconcilable, 'Require reconciliation'],
        ].map(([label, value, hint], index) => <article key={String(label)} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="flex size-8 items-center justify-center rounded-xl bg-primary/8 text-primary">{index === 0 ? <BookOpen className="size-4" /> : <WalletCards className="size-4" />}</span></div><p className="mt-3 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{hint}</p></article>)}
      </div>

      <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search code, account name, or type..." emptyText="No accounts found" minWidth="1000px" action={<button onClick={createAccount} disabled={!companies.length || !accountTypes.length} className={btnCreatePage}><Plus className="size-4" /> Add Account</button>} filters={<><select value={codeFilter} onChange={(event) => setCodeFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All codes</option>{['1', '2', '3', '4', '5'].map((digit) => <option key={digit} value={digit}>Code {digit}</option>)}</select><FilterSelect label="All account types" value={typeFilter} onChange={setTypeFilter} options={accountTypes.map((row) => ({ value: String(row.id), label: String(row.name) }))} /><FilterSelect label="All companies" value={companyFilter} onChange={setCompanyFilter} options={companies.map((row) => ({ value: String(row.id), label: String(row.name) }))} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button onClick={() => void loadData()} disabled={loading} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />
      <section className="hidden">
        <aside className="w-[72px] shrink-0 border-r bg-muted/10 p-2">
          <div className="mb-2 flex h-9 items-center justify-center border-b text-muted-foreground"><ChevronLeft className="size-4" /></div>
          <nav aria-label="Filter by account code" className="space-y-1">
            {['all', '1', '2', '3', '4', '5'].map((digit) => (
              <button key={digit} onClick={() => setCodeFilter(digit)} className={`flex h-9 w-full items-center justify-center gap-1 rounded-lg text-xs font-semibold transition ${codeFilter === digit ? 'border border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                {digit !== 'all' && <ChevronRight className="size-3" />}{digit === 'all' ? 'All' : digit}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
        <div className="grid gap-3 border-b p-4 lg:grid-cols-[minmax(240px,1fr)_180px_180px_140px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code, account name, or type..." className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></div>
          <FilterSelect label="All account types" value={typeFilter} onChange={setTypeFilter} options={accountTypes.map((row) => ({ value: String(row.id), label: String(row.name) }))} />
          <FilterSelect label="All companies" value={companyFilter} onChange={setCompanyFilter} options={companies.map((row) => ({ value: String(row.id), label: String(row.name) }))} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-xs outline-none focus:border-primary"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <div className="flex items-center justify-between gap-3 lg:justify-end"><span className="whitespace-nowrap text-xs text-muted-foreground">{filtered.length} accounts</span><button onClick={() => void loadData()} disabled={loading} className="rounded-lg border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Select all accounts" checked={filtered.length > 0 && filtered.every((account) => selectedIds.has(account.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(filtered.map((account) => account.id)) : new Set())} className="size-4 accent-primary" /></th><th className="w-40 px-4 py-3 font-semibold"><span className="flex items-center gap-1">Code <ChevronsUpDown className="size-3" /></span></th><th className="px-4 py-3 font-semibold"><span className="flex items-center gap-1">Name <ChevronsUpDown className="size-3" /></span></th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Company</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? Array.from({ length: 5 }, (_, index) => <tr key={index}>{Array.from({ length: 7 }, (__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-muted" /></td>)}</tr>) : filtered.map((account) => {
                const type = typeMap.get(Number(account.account_type_id)); const parent = accountMap.get(Number(account.parent_id));
                return <tr key={account.id} className={`transition hover:bg-muted/30 ${selectedIds.has(account.id) ? 'bg-primary/[0.03]' : ''}`}><td className="px-4 py-4"><input type="checkbox" aria-label={`Select ${String(account.name)}`} checked={selectedIds.has(account.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(account.id); else next.delete(account.id); return next; })} className="size-4 accent-primary" /></td><td className="px-4 py-4 font-mono text-sm font-semibold text-foreground">{String(account.code)}</td><td className="px-4 py-4"><div className="flex items-center gap-2">{parent && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}<div><p className="text-sm font-medium">{String(account.name)}</p>{parent && <p className="mt-0.5 text-[10px] text-muted-foreground">Under {String(parent.name)}</p>}</div></div></td><td className="px-4 py-4"><p className="font-medium">{String(type?.name || 'Unknown')}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{humanize(type?.internal_group)}</p></td><td className="px-4 py-4 text-muted-foreground">{String(companyMap.get(Number(account.company_id))?.name || '—')}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${account.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{Boolean(account.is_active) && <Check className="size-3" />}{account.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button onClick={() => editAccount(account)} className="rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Edit3 className="size-4" /></button><button onClick={() => { setSelected(account); setDeleteOpen(true); }} className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="size-4" /></button></div></td></tr>;
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <div className="flex flex-col items-center px-6 py-16 text-center"><div className="flex size-12 items-center justify-center rounded-2xl bg-primary/8 text-primary"><BookOpen className="size-5" /></div><h3 className="mt-4 text-sm font-semibold">No accounts found</h3><p className="mt-1 text-xs text-muted-foreground">Change your filters or add a new ledger account.</p></div>}
        </div></div>
      </section>

      <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{selected ? 'Edit Account' : 'Add Ledger Account'}</DialogTitle><DialogDescription>Configure the identity, classification, hierarchy, and posting behavior for this account.</DialogDescription></DialogHeader><form onSubmit={saveAccount} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Company" required value={form.company_id} onChange={(value) => setForm((current) => ({ ...current, company_id: value, parent_id: '' }))} options={companies.map((row) => ({ value: String(row.id), label: String(row.name) }))} />
          <SelectField label="Account Type" required value={form.account_type_id} onChange={(value) => setForm((current) => ({ ...current, account_type_id: value, parent_id: '' }))} options={accountTypes.map((row) => ({ value: String(row.id), label: `${String(row.name)} — ${humanize(row.internal_group)}` }))} />
          <TextField label="Account Code" required value={form.code} maxLength={16} placeholder="e.g. 1100" onChange={(value) => setForm((current) => ({ ...current, code: value }))} />
          <TextField label="Account Name" required value={form.name} maxLength={128} placeholder="e.g. Cash on Hand" onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
          <SelectField label="Parent Account" value={form.parent_id} onChange={(value) => setForm((current) => ({ ...current, parent_id: value }))} emptyLabel="No parent account" options={eligibleParents.map((row) => ({ value: String(row.id), label: `${String(row.code)} — ${String(row.name)}` }))} />
          <SelectField label="Account Currency" value={form.currency_id} onChange={(value) => setForm((current) => ({ ...current, currency_id: value }))} emptyLabel="Use company currency" options={currencies.filter((row) => row.is_active).map((row) => ({ value: String(row.id), label: `${String(row.code)} — ${String(row.name)}` }))} />
          <label className="sm:col-span-2"><span className="text-xs font-semibold">Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Optional internal description or usage guidance" className="mt-1.5 w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
          <Toggle label="Allow Manual Entries" hint="Users can post journal items directly to this account" checked={form.allow_manual_entry} onChange={(checked) => setForm((current) => ({ ...current, allow_manual_entry: checked }))} />
          <Toggle label="Reconcilable" hint="Transactions can be matched and reconciled" checked={form.is_reconcilable} onChange={(checked) => setForm((current) => ({ ...current, is_reconcilable: checked }))} />
          <Toggle label="Active Account" hint="Available for new accounting transactions" checked={form.is_active} onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))} full />
        </div><DialogFooter><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="h-10 rounded-xl border px-5 text-xs font-semibold hover:bg-muted">Cancel</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Account'}</button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !saving && setDeleteOpen(open)}><DialogContent className="sm:max-w-md"><DialogHeader><div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10"><Trash2 className="size-5" /></div><DialogTitle>Delete account?</DialogTitle><DialogDescription>You are deleting {selected ? `${String(selected.code)} — ${String(selected.name)}` : 'this account'}. Accounts linked to transactions or child accounts cannot be deleted.</DialogDescription></DialogHeader><DialogFooter><button onClick={() => setDeleteOpen(false)} disabled={saving} className="h-10 rounded-xl border px-5 text-xs font-semibold hover:bg-muted">Cancel</button><button onClick={() => void deleteAccount()} disabled={saving} className="h-10 rounded-xl bg-rose-600 px-5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{saving ? 'Deleting...' : 'Delete Account'}</button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-xs outline-none focus:border-primary"><option value="all">{label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>; }
function SelectField({ label, value, onChange, options, required, emptyLabel }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean; emptyLabel?: string }) { return <label><span className="text-xs font-semibold">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</span><select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"><option value="">{emptyLabel || `Select ${label.toLowerCase()}`}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function TextField({ label, value, onChange, required, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; maxLength?: number }) { return <label><span className="text-xs font-semibold">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>; }
function Toggle({ label, hint, checked, onChange, full }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void; full?: boolean }) { return <label className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3 ${full ? 'sm:col-span-2' : ''}`}><div><span className="text-xs font-semibold">{label}</span><p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button></label>; }
