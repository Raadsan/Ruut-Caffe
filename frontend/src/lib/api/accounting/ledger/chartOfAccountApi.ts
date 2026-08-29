import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type ChartOfAccount = AccountingRecord;
export const chartOfAccountApi = createAccountingCrudApi<ChartOfAccount>('/accounting/chart-of-accounts');
