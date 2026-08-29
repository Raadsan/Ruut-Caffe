import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type AccountingTax = AccountingRecord;
export const accountingTaxApi = createAccountingCrudApi<AccountingTax>('/accounting/configuration/taxes');
