import api from '../../axios';
import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';

export type ReceiptAllocation = {
  id?: number;
  invoice_id: number;
  allocated_amount: number;
  customer_invoices?: { id: number; invoice_number?: string; amount_total: number; amount_due: number };
};

export type CustomerReceipt = AccountingRecord & {
  receipt_number?: string;
  customer_id: number;
  journal_id: number;
  payment_method_id: number;
  receipt_date: string;
  currency_id: number;
  exchange_rate: number;
  amount: number;
  unallocated_amount: number;
  reference?: string | null;
  memo?: string | null;
  state: string;
  customers?: { id: number; name: string; phone?: string };
  currencies?: { id: number; code: string; symbol?: string };
  journals?: { id: number; name: string; code: string };
  payment_methods?: { id: number; name: string; code: string };
  receipt_allocations?: ReceiptAllocation[];
  journal_entries?: {
    journal_items?: Array<{ account_id: number; chart_of_accounts?: { id: number; code: string; name: string } }>;
  };
};

const crud = createAccountingCrudApi<CustomerReceipt>('/accounting/customer-receipts');
export const customerReceiptApi = {
  ...crud,
  options: async (params: { customer_id: number; payment_method_id: number; currency_id?: number }) => {
    const response = await api.get('/accounting/customer-receipts/options', { params });
    return response.data.data as {
      channel: string; company_currency_id: number; currency_id: number; selected_account_id?: number | null;
      accounts: Array<{ id: number; code: string; name: string; account_name: string; journal_id: number; journal_name: string; journal_code: string }>;
    };
  },
  outstandingInvoices: async (customerId: number) => {
    const response = await api.get('/accounting/customer-receipts/outstanding-invoices', { params: { customer_id: customerId } });
    return response.data.data as import('./customerInvoiceApi').CustomerInvoice[];
  },
  post: async (id: number): Promise<CustomerReceipt> => {
    const response = await api.patch(`/accounting/customer-receipts/${id}/post`);
    return response.data.data;
  },
};
