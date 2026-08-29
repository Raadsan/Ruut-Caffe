'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  details?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function AccountingConfirmDialog({ open, title, description, confirmLabel, busy, destructive, details, onCancel, onConfirm }: Props) {
  const Icon = destructive ? AlertTriangle : Send;
  return <Dialog open={open} onOpenChange={(value) => !busy && !value && onCancel()}><DialogContent className="sm:max-w-lg"><DialogHeader><div className={`mb-2 flex size-11 items-center justify-center rounded-xl ${destructive ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}><Icon className="size-5" /></div><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{details && <div className="rounded-xl border bg-muted/20 p-4 text-sm">{details}</div>}<div className={`rounded-xl border p-3 text-xs ${destructive ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{destructive ? 'This action cannot be undone.' : 'Posting locks this record from further editing.'}</div><DialogFooter><button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-xl border px-5 font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className={`h-10 rounded-xl px-5 font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-rose-700' : 'bg-primary'}`}>{busy ? 'Processing…' : confirmLabel}</button></DialogFooter></DialogContent></Dialog>;
}
