import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type AccountType = AccountingRecord;
export const accountTypeApi = createAccountingCrudApi<AccountType>('/accounting/configuration/account-types');
