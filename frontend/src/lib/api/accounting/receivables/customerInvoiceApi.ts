import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type CustomerInvoiceLine = {
  id?: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_id?: number | null;
  income_account_id?: number;
  subtotal?: number;
  products?: { id: number; name: string; sku?: string };
  taxes?: { id: number; name: string; rate_percent: number; price_includes_tax: boolean };
};
export type CustomerInvoice = AccountingRecord & {
  invoice_number?: string;
  customer_id: number;
  invoice_date: string;
  due_date?: string | null;
  state: string;
  payment_state: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  paid_amount: number;
  amount_due: number;
  customers?: { id: number; name: string; phone?: string };
  currencies?: { id: number; code: string; symbol?: string };
  customer_invoice_lines?: CustomerInvoiceLine[];
};
const crud = createAccountingCrudApi<CustomerInvoice>('/accounting/customer-invoices');
export const customerInvoiceApi = {
  ...crud,
  post: async (id: number): Promise<CustomerInvoice> => {
    const response = await (await import('../../axios')).default.post(`/accounting/customer-invoices/${id}/post`);
    return response.data.data;
  },
};
