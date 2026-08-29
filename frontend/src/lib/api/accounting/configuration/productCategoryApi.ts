import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type AccountingProductCategory = AccountingRecord;
export const accountingProductCategoryApi = createAccountingCrudApi<AccountingProductCategory>('/accounting/configuration/product-categories');
