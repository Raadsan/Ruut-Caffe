import api from '../../axios';
import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type BankAccount = AccountingRecord;
const crud = createAccountingCrudApi<BankAccount>('/accounting/bank-accounts');
export const bankAccountApi = {
  ...crud,
  getEligibleGlAccounts: async (): Promise<AccountingRecord[]> => {
    const response = await api.get('/accounting/bank-accounts/eligible-gl-accounts');
    return response.data.data || [];
  },
};
