import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type FiscalPeriod = AccountingRecord;
export const fiscalPeriodApi = createAccountingCrudApi<FiscalPeriod>('/accounting/fiscal-periods');
