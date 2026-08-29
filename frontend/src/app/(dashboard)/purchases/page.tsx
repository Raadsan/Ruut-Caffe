'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Eye, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/shared/DashboardDataTable';
import { usePermissions } from '@/context/PermissionContext';
import { useToast } from '@/components/ui/toast';
import { purchaseApi, type Purchase, type PurchaseLineInput } from '@/lib/api/restaurant/purchaseApi';
import { menuItemApi, type MenuItem } from '@/lib/api/restaurant/menuItemApi';
import api from '@/lib/api/axios';
import { actionBtnView, btnCreatePage, dashboardStatusBadgeClass, pageHeaderTitleClass, pageHeaderWrapperClass } from '@/lib/dashboard-ui';

type Supplier = { id: number; name: string; is_active?: boolean };
type FormLine = PurchaseLineInput & { key: number };
const emptyLine = (): FormLine => ({ key: Date.now() + Math.random(), description: '', quantity: 1, unit: 'Piece', unitCost: 0 });
const commonUnits = ['Kg', 'Gram', 'Liter', 'Milliliter', 'Piece', 'Bottle', 'Box', 'Bag', 'Carton', 'Pack', 'Dozen'];
const today = () => new Date().toISOString().slice(0, 10);
const message = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';
const amount = (value: number) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PurchasesPage() {
  const { showToast } = useToast();
  const permissions = usePermissions();
  const canAdd = permissions.canAdd('/purchases');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Purchase | null>(null);
  const [supplierId, setSupplierId] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [purchaseResult, supplierResult, menuResult] = await Promise.allSettled([
        purchaseApi.getAll(), api.get('/vendors').then((res) => res.data.data || []), menuItemApi.getAllMenuItems(),
      ]);
      if (purchaseResult.status === 'fulfilled') setPurchases(purchaseResult.value);
      else { setPurchases([]); showToast(`Purchases: ${message(purchaseResult.reason)}`, 'error'); }
      if (supplierResult.status === 'fulfilled') setSuppliers(supplierResult.value);
      else { setSuppliers([]); showToast(`Vendors: ${message(supplierResult.reason)}`, 'error'); }
      if (menuResult.status === 'fulfilled') setMenuItems(menuResult.value.filter((item) => item.isPurchasable));
    } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return purchases.filter((purchase) => !needle || [purchase.purchaseNumber, purchase.supplier.name, purchase.purchaseDate].some((value) => String(value).toLowerCase().includes(needle)));
  }, [purchases, query]);
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);

  const beginCreate = () => { setSupplierId(0); setPurchaseDate(today()); setNotes(''); setLines([emptyLine()]); setFormOpen(true); };
  const updateLine = (key: number, patch: Partial<FormLine>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supplierId) return showToast('Select a supplier', 'error');
    if (lines.some((line) => !line.description.trim() || !line.unit.trim() || line.quantity <= 0 || line.unitCost < 0)) return showToast('Complete every purchase item', 'error');
    setSaving(true);
    try {
      await purchaseApi.create({ supplierId, purchaseDate, notes, lines: lines.map(({ menuItemId, description, quantity, unit, unitCost }) => ({ menuItemId, description: description.trim(), quantity, unit: unit.trim(), unitCost })) });
      showToast('Purchase received and posted to Accounts Payable', 'success'); setFormOpen(false); await refresh();
    } catch (error) { showToast(message(error), 'error'); } finally { setSaving(false); }
  };
  const columns: DashboardTableColumn<Purchase>[] = [
    { key: 'purchaseNumber', header: 'Purchase #', cell: (row) => <span className="font-bold text-primary">{row.purchaseNumber}</span> },
    { key: 'purchaseDate', header: 'Date', cell: (row) => new Date(row.purchaseDate).toLocaleDateString() },
    { key: 'supplier', header: 'Supplier', cell: (row) => <span className="font-medium">{row.supplier.name}</span> },
    { key: 'lines', header: 'Items', align: 'center', cell: (row) => row.lines.length },
    { key: 'totalAmount', header: 'Total', align: 'right', cell: (row) => amount(row.totalAmount) },
    { key: 'status', header: 'Status', align: 'center', cell: () => <span className={`${dashboardStatusBadgeClass} bg-emerald-600 text-white`}>Received</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end"><button onClick={() => setViewing(row)} className={actionBtnView} aria-label="View purchase"><Eye className="size-4" /></button></div> },
  ];

  return <main className="dashboard-scope space-y-5 p-4 sm:p-6 lg:p-8">
    <div className={pageHeaderWrapperClass}><h1 className={pageHeaderTitleClass}>Purchases</h1><p className="mt-1 text-sm text-muted-foreground">Record supplier purchases quickly and post them directly to Accounts Payable.</p></div>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search purchases..." emptyText="No purchases found" minWidth="900px" action={canAdd ? <button onClick={beginCreate} className={btnCreatePage}><Plus className="size-4" /> New purchase</button> : undefined} filters={<button onClick={() => void refresh()} className="flex size-[42px] items-center justify-center rounded-md border" aria-label="Refresh"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>} />

    <Dialog open={formOpen} onOpenChange={(value) => !saving && setFormOpen(value)}><DialogContent className="max-h-[94vh] max-w-[calc(100vw-2rem)] overflow-y-auto xl:max-w-[1050px]"><DialogHeader><DialogTitle>Receive purchase</DialogTitle><DialogDescription>Enter the supplier invoice details. Accounting is handled automatically.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Supplier *<select required value={supplierId || ''} onChange={(event) => setSupplierId(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border bg-background px-3"><option value="">Select supplier</option>{suppliers.filter((supplier) => supplier.is_active !== false).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="text-sm font-medium">Purchase date *<input required type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3" /></label></div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[800px] text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-left">Quantity</th><th className="p-3 text-left">Unit</th><th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Total</th><th className="w-12" /></tr></thead><tbody>{lines.map((line) => <tr key={line.key} className="border-t">
        <td className="p-2"><select required value={line.menuItemId || ''} onChange={(event) => { const item = menuItems.find((row) => row.id === Number(event.target.value)); updateLine(line.key, { menuItemId: item?.id || null, description: item?.name || '', unitCost: Number(item?.costPrice || 0) }); }} className="h-10 min-w-56 w-full rounded-lg border bg-background px-3"><option value="">Select purchasable item</option>{menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
        <td className="p-2"><input required min="0.01" step="any" type="number" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} className="h-10 w-24 rounded-lg border px-2 text-right" /></td><td className="p-2"><input required list="purchase-units" maxLength={32} value={line.unit} onChange={(event) => updateLine(line.key, { unit: event.target.value })} placeholder="Unit" className="h-10 w-28 rounded-lg border px-3" /></td><td className="p-2"><input required min="0" step="1" type="number" value={line.unitCost} onChange={(event) => updateLine(line.key, { unitCost: Number(event.target.value) })} className="h-10 w-32 rounded-lg border px-2 text-right" /></td><td className="p-2 text-right font-semibold tabular-nums">{amount(line.quantity * line.unitCost)}</td><td className="p-2 text-center"><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="text-destructive disabled:opacity-30" aria-label="Remove item"><Trash2 className="size-4" /></button></td></tr>)}</tbody></table><datalist id="purchase-units">{commonUnits.map((unit) => <option key={unit} value={unit} />)}</datalist><button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="m-3 flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-3" /> Add item</button></div>
      <div className="grid gap-4 sm:grid-cols-[1fr_260px]"><label className="text-sm font-medium">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-3" /></label><div className="rounded-xl border bg-muted/20 p-4"><p className="text-sm text-muted-foreground">Purchase total</p><p className="mt-1 text-2xl font-bold">{amount(total)}</p></div></div>
      <DialogFooter><button type="button" onClick={() => setFormOpen(false)} className="h-10 rounded-lg border px-4">Cancel</button><button disabled={saving} className="h-10 rounded-lg bg-primary px-5 font-semibold text-white">{saving ? 'Receiving...' : 'Receive purchase'}</button></DialogFooter>
    </form></DialogContent></Dialog>

    <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{viewing?.purchaseNumber}</DialogTitle><DialogDescription>{viewing && `${viewing.supplier.name} · ${new Date(viewing.purchaseDate).toLocaleDateString()}`}</DialogDescription></DialogHeader>{viewing && <div className="space-y-4"><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Description</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{viewing.lines.map((line) => <tr key={line.id} className="border-t"><td className="p-3">{line.description}</td><td className="p-3 text-right">{line.quantity} {line.unit}</td><td className="p-3 text-right">{amount(line.unitCost)}</td><td className="p-3 text-right">{amount(line.lineTotal)}</td></tr>)}</tbody></table></div>{viewing.notes && <p className="text-sm text-muted-foreground">Notes: {viewing.notes}</p>}<p className="text-right text-lg font-bold">Grand total: {amount(viewing.totalAmount)}</p></div>}</DialogContent></Dialog>
  </main>;
}
