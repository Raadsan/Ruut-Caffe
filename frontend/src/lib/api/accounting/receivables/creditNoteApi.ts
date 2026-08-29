import api from '../../axios';
import { createAccountingCrudApi } from '../accountingCrud';
import type { CustomerInvoice } from './customerInvoiceApi';

export type CreditNote = CustomerInvoice & {
  reversed_invoice_id: number;
  customer_reference?: string | null;
  notes?: string | null;
  customer_invoices?: {
    id: number; invoice_number?: string; invoice_date: string;
    amount_total: number; amount_due: number; payment_state: string;
  };
};

const crud = createAccountingCrudApi<CreditNote>('/accounting/credit-notes');
export const creditNoteApi = {
  ...crud,
  post: async (id: number): Promise<CreditNote> => {
    const response = await api.patch(`/accounting/credit-notes/${id}/post`);
    return response.data.data;
  },
};
