import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type AccountingCustomer = AccountingRecord;
export const accountingCustomerApi = createAccountingCrudApi<AccountingCustomer>('/customers');
