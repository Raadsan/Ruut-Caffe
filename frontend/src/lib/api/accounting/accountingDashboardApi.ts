import { companyApi } from "./configuration/companyApi";
import { accountingReportApi } from "./accountingReportApi";

export interface AccountingDashboardData {
  totalRevenue: number;
  expenses: number;
  netProfit: number;
  cashBalance: number;
  bankBalance: number;
  chartData: AccountingChartPoint[];
  expenseBreakdown: AccountingExpensePoint[];
  recentTransactions: AccountingRecentTransaction[];
  updatedAt: string;
}

export interface AccountingChartPoint {
  date: string;
  revenue: number;
  expense: number;
  cashIn: number;
  cashOut: number;
}

export interface AccountingExpensePoint {
  name: string;
  value: number;
  amount: number;
  color: string;
}

export interface AccountingRecentTransaction {
  id: number;
  date: string;
  type: string;
  description: string;
  account: string;
  amount: number;
  status: string;
}

const COLORS = ['#012e67', '#022d71', '#174f91', '#3b73ae', '#6f95c8'];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodRange(period = 'This Month') {
  const now = new Date();
  if (period === 'Last Month') {
    return {
      startDate: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      endDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (period === 'This Quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      startDate: isoDate(new Date(now.getFullYear(), quarterStartMonth, 1)),
      endDate: isoDate(new Date(now.getFullYear(), quarterStartMonth + 3, 0)),
    };
  }
  return {
    startDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function emptyDashboard(): AccountingDashboardData {
  return {
    totalRevenue: 0,
    expenses: 0,
    netProfit: 0,
    cashBalance: 0,
    bankBalance: 0,
    chartData: [],
    expenseBreakdown: [],
    recentTransactions: [],
    updatedAt: new Date().toISOString(),
  };
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown) {
  return Number(value || 0);
}

function chartLabel(dateValue: unknown) {
  const key = String(dateValue || new Date().toISOString()).slice(0, 10);
  const parsed = new Date(key);
  return {
    key,
    label: Number.isNaN(parsed.getTime())
      ? key
      : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}

export const accountingDashboardApi = {
  getSummary: async (period = 'This Month'): Promise<AccountingDashboardData> => {
    const companies = await companyApi.getAll();
    const company = companies.find((item) => item.is_active !== false) ?? companies[0];
    if (!company) {
      return emptyDashboard();
    }

    const companyId = Number(company.id);
    const range = periodRange(period);
    const [profitAndLoss, cashFlow, journalReport] = await Promise.all([
      accountingReportApi.getProfitAndLoss({ companyId, ...range }),
      accountingReportApi.getCashFlow({ companyId, ...range }),
      accountingReportApi.getJournalReport({ companyId, ...range }),
    ]);

    const totalRevenue = Number(profitAndLoss?.income?.total || 0);
    const expenses = Number(profitAndLoss?.expense?.total || 0);
    const cashBalance = Number(cashFlow?.closing_balance || 0);
    const bankBalance = Array.isArray(cashFlow?.accounts)
      ? cashFlow.accounts.reduce((sum: number, account: { closing_balance?: number | string }) => sum + Number(account.closing_balance || 0), 0)
      : cashBalance;
    const entries = array(journalReport).map(record);
    const chartByDate = new Map<string, AccountingChartPoint>();

    entries.forEach((entry) => {
      const { key, label } = chartLabel(entry.entry_date || entry.created_at);
      const sourceType = String(entry.source_type || '');
      const debit = num(entry.total_debit);
      const credit = num(entry.total_credit);
      const point = chartByDate.get(key) || { date: label, revenue: 0, expense: 0, cashIn: 0, cashOut: 0 };
      if (sourceType.includes('vendor')) point.expense += debit;
      if (sourceType.includes('customer') || sourceType.includes('pos')) point.revenue += credit;
      point.cashIn += debit;
      point.cashOut += credit;
      chartByDate.set(key, point);
    });

    const expenseAccounts = array(record(profitAndLoss?.expense).accounts).map(record);
    const expenseBreakdown = expenseAccounts
      .map((account, index) => {
        const amount = Math.abs(num(account.balance));
        return {
          name: String(account.account_name || account.account_code || 'Expense'),
          value: expenses ? Math.round((amount / Math.abs(expenses)) * 100) : 0,
          amount,
          color: COLORS[index % COLORS.length],
        };
      })
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const recentTransactions = entries
      .sort((a, b) => new Date(String(b.entry_date || b.created_at || 0)).getTime() - new Date(String(a.entry_date || a.created_at || 0)).getTime())
      .slice(0, 6)
      .map((entry) => {
        const journal = record(entry.journals);
        const firstLine = record(array(entry.journal_items)[0]);
        const account = record(firstLine.chart_of_accounts);
        return {
          id: num(entry.id),
          date: String(entry.entry_date || entry.created_at || new Date().toISOString()),
          type: titleCase(String(entry.source_type || journal.name || 'Journal')),
          description: String(entry.narration || entry.reference || entry.entry_number || 'Journal entry'),
          account: String(account.name || journal.name || 'Ledger'),
          amount: Math.max(num(entry.total_debit), num(entry.total_credit)),
          status: titleCase(String(entry.state || 'posted')),
        };
      });

    return {
      totalRevenue,
      expenses,
      netProfit: Number(profitAndLoss?.net_income ?? totalRevenue - expenses),
      cashBalance,
      bankBalance,
      chartData: [...chartByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, point]) => point),
      expenseBreakdown,
      recentTransactions,
      updatedAt: new Date().toISOString(),
    };
  },
};
