import api from '../axios';

export interface AccountingReportFilters {
  companyId: number;
  startDate?: string;
  endDate?: string;
  periodId?: number;
}

const reportParams = (filters: AccountingReportFilters) => ({
  company_id: filters.companyId,
  start_date: filters.startDate,
  end_date: filters.endDate,
  period_id: filters.periodId,
});

export const accountingReportApi = {
  getGeneralLedger: async (filters: AccountingReportFilters & { accountId?: number }) => {
    const response = await api.get('/accounting/reports/general-ledger', {
      params: { ...reportParams(filters), account_id: filters.accountId },
    });
    return response.data.data;
  },

  getTrialBalance: async (filters: AccountingReportFilters) => {
    const response = await api.get('/accounting/reports/trial-balance', {
      params: reportParams(filters),
    });
    return response.data.data;
  },

  getProfitAndLoss: async (filters: AccountingReportFilters) => {
    const response = await api.get('/accounting/reports/profit-and-loss', {
      params: reportParams(filters),
    });
    return response.data.data;
  },

  getBalanceSheet: async (companyId: number, asOfDate?: string) => {
    const response = await api.get('/accounting/reports/balance-sheet', {
      params: { company_id: companyId, as_of_date: asOfDate },
    });
    return response.data.data;
  },

  getCashFlow: async (filters: AccountingReportFilters) => {
    const response = await api.get('/accounting/reports/cash-flow', { params: reportParams(filters) });
    return response.data.data;
  },

  getJournalReport: async (filters: AccountingReportFilters & { journalId?: number }) => {
    const response = await api.get('/accounting/reports/journal-report', {
      params: { ...reportParams(filters), journal_id: filters.journalId },
    });
    return response.data.data;
  },
};
