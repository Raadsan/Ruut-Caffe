import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type Vendor = AccountingRecord;
export const vendorApi = createAccountingCrudApi<Vendor>('/vendors');
