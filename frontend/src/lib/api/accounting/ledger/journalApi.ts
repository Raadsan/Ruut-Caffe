import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type AccountingJournal = AccountingRecord;
export const accountingJournalApi = createAccountingCrudApi<AccountingJournal>('/accounting/journals');
