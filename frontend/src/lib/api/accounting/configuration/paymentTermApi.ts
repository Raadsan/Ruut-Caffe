import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type PaymentTerm = AccountingRecord;
export const paymentTermApi = createAccountingCrudApi<PaymentTerm>('/accounting/configuration/payment-terms');
