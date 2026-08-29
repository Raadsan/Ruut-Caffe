import api from '../../axios';
import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type AccountingPaymentMethod = AccountingRecord;
export const accountingPaymentMethodApi = createAccountingCrudApi<AccountingPaymentMethod>('/accounting/configuration/payment-methods');

export const paymentMethodGlAccountApi = {
  getEligible: async (): Promise<AccountingRecord[]> => {
    const response = await api.get('/accounting/configuration/payment-methods/eligible-gl-accounts');
    return response.data.data || [];
  },
};
