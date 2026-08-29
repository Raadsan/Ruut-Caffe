import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type AccountingProduct = AccountingRecord;
export const accountingProductApi = createAccountingCrudApi<AccountingProduct>('/accounting/products');
