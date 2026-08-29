import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type Company = AccountingRecord;
export const companyApi = createAccountingCrudApi<Company>('/accounting/configuration/companies');
