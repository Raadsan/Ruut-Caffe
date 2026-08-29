import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type Currency = AccountingRecord;
export const currencyApi = createAccountingCrudApi<Currency>('/accounting/configuration/currencies');
