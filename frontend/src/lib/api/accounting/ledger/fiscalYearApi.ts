import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type FiscalYear = AccountingRecord;
export const fiscalYearApi = createAccountingCrudApi<FiscalYear>('/accounting/fiscal-years');
