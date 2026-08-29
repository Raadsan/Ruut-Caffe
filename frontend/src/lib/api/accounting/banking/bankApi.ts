import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type Bank = AccountingRecord;
export const bankApi = createAccountingCrudApi<Bank>('/accounting/banks');
