import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type VendorPayment = AccountingRecord & {
  payment_number?: string; vendor_id: number; journal_id: number; payment_method_id: number; bank_account_id?: number;
  payment_date: string; currency_id: number; exchange_rate: number; amount: number; unallocated_amount: number;
  reference?: string; memo?: string; state: string;
  vendors?: { id: number; name: string; vendor_code?: string };
  currencies?: { id: number; code: string }; payment_methods?: { id: number; name: string; allow_multiple_accounts?: boolean; chart_of_accounts?: { id: number; name: string } };
  journals?: { id: number; name: string; code: string }; bank_accounts?: { id: number; account_name: string; account_number: string };
  payment_allocations?: Array<{ bill_id: number; allocated_amount: number }>;
  vendor_advances?: VendorAdvance[];
};
export type VendorAdvance = AccountingRecord & { vendor_id: number; currency_id: number; original_amount: number; remaining_amount: number; state: string };
const crud = createAccountingCrudApi<VendorPayment>('/accounting/vendor-payments');
export const vendorPaymentApi = {
  ...crud,
  post: async (id: number): Promise<VendorPayment> => {
    const response = await (await import('../../axios')).default.post(`/accounting/vendor-payments/${id}/post`);
    return response.data.data;
  },
  getAdvances: async (vendorId: number, currencyId?: number): Promise<{ rows: VendorAdvance[]; balance: number }> => {
    const api = (await import('../../axios')).default;
    const response = await api.get('/accounting/vendor-payments/advances/available', { params: { vendor_id: vendorId, currency_id: currencyId } });
    return { rows: response.data.data || [], balance: Number(response.data.summary?.advance_balance || 0) };
  },
};
