import prisma from '../../../config/db.js';

/**
 * Helper to get the correct fiscal period or date range for reports
 */
const getEntryFilter = (startDate, endDate, periodId) => {
  const filter = {};
  if (periodId) filter.fiscal_period_id = parseInt(periodId);
  if (!periodId && (startDate || endDate)) {
    filter.entry_date = {};
    if (startDate) filter.entry_date.gte = new Date(startDate);
    if (endDate) filter.entry_date.lte = new Date(endDate);
  }
  return filter;
};

// GET General Ledger
export const getGeneralLedger = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id, account_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });

    const where = {
      journal_entries: { company_id: parseInt(company_id), state: 'posted', ...getEntryFilter(start_date, end_date, period_id) }
    };
    
    if (account_id) where.account_id = parseInt(account_id);
    
    const items = await prisma.journal_items.findMany({
      where,
      orderBy: [
        { account_id: 'asc' },
        { journal_entries: { entry_date: 'asc' } }
      ],
      include: {
        journal_entries: { select: { entry_date: true, entry_number: true, reference: true, narration: true } },
        chart_of_accounts: { select: { code: true, name: true, account_types: { select: { normal_balance: true } } } },
        currencies: { select: { code: true, symbol: true } }
      }
    });

    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error('General Ledger Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Trial Balance
export const getTrialBalance = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });

    const where = {
      journal_entries: { company_id: parseInt(company_id), state: 'posted', ...getEntryFilter(start_date, end_date, period_id) }
    };
    const result = await prisma.journal_items.groupBy({
      by: ['account_id'],
      where,
      _sum: { debit: true, credit: true }
    });

    const accounts = await prisma.chart_of_accounts.findMany({
      where: { id: { in: result.map(r => r.account_id) } },
      select: { id: true, code: true, name: true, account_types: { select: { normal_balance: true } } }
    });

    const data = result.map(item => {
      const account = accounts.find(a => a.id === item.account_id);
      const debit = parseFloat(item._sum.debit || 0);
      const credit = parseFloat(item._sum.credit || 0);
      let balance = 0;
      
      if (account?.account_types?.normal_balance === 'debit') {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

      return {
        account_id: item.account_id,
        account_code: account?.code,
        account_name: account?.name,
        normal_balance: account?.account_types?.normal_balance,
        total_debit: debit,
        total_credit: credit,
        balance
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Trial Balance Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Profit and Loss (Income Statement)
export const getProfitAndLoss = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });

    const where = {
      journal_entries: { company_id: parseInt(company_id), state: 'posted', ...getEntryFilter(start_date, end_date, period_id) },
      chart_of_accounts: { account_types: { internal_group: { in: ['income', 'expense'] } } }
    };
    const result = await prisma.journal_items.groupBy({
      by: ['account_id'],
      where,
      _sum: { debit: true, credit: true }
    });

    const accounts = await prisma.chart_of_accounts.findMany({
      where: { id: { in: result.map(r => r.account_id) } },
      select: { id: true, code: true, name: true, account_types: { select: { internal_group: true, normal_balance: true } } }
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeAccounts = [];
    const expenseAccounts = [];

    result.forEach(item => {
      const account = accounts.find(a => a.id === item.account_id);
      if (!account) return;

      const debit = parseFloat(item._sum.debit || 0);
      const credit = parseFloat(item._sum.credit || 0);
      const balance = account.account_types.normal_balance === 'credit' ? (credit - debit) : (debit - credit);

      const entry = {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        balance
      };

      if (account.account_types.internal_group === 'income') {
        totalIncome += balance;
        incomeAccounts.push(entry);
      } else if (account.account_types.internal_group === 'expense') {
        totalExpense += balance;
        expenseAccounts.push(entry);
      }
    });

    const netIncome = totalIncome - totalExpense;

    res.status(200).json({
      success: true,
      data: {
        income: { total: totalIncome, accounts: incomeAccounts },
        expense: { total: totalExpense, accounts: expenseAccounts },
        net_income: netIncome
      }
    });
  } catch (error) {
    console.error('P&L Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Cash Flow (direct movement of configured cash and bank GL accounts)
export const getCashFlow = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const companyId = parseInt(company_id);
    const bankAccounts = await prisma.bank_accounts.findMany({
      where: { company_id: companyId, is_active: true, gl_account_id: { not: null } },
      select: { id: true, account_name: true, account_number: true, gl_account_id: true, currencies: { select: { code: true } } },
    });
    const accountIds = [...new Set(bankAccounts.map((row) => row.gl_account_id).filter(Boolean))];
    if (!accountIds.length) return res.json({ success: true, data: { accounts: [], opening_balance: 0, inflows: 0, outflows: 0, net_change: 0, closing_balance: 0 } });

    const periodWhere = { account_id: { in: accountIds }, journal_entries: { company_id: companyId, state: 'posted', ...getEntryFilter(start_date, end_date, period_id) } };
    const [periodGroups, openingGroups] = await Promise.all([
      prisma.journal_items.groupBy({ by: ['account_id'], where: periodWhere, _sum: { debit: true, credit: true } }),
      start_date && !period_id ? prisma.journal_items.groupBy({
        by: ['account_id'],
        where: { account_id: { in: accountIds }, journal_entries: { company_id: companyId, state: 'posted', entry_date: { lt: new Date(start_date) } } },
        _sum: { debit: true, credit: true },
      }) : Promise.resolve([]),
    ]);
    let openingBalance = 0; let inflows = 0; let outflows = 0;
    const accounts = bankAccounts.map((bank) => {
      const period = periodGroups.find((row) => row.account_id === bank.gl_account_id);
      const opening = openingGroups.find((row) => row.account_id === bank.gl_account_id);
      const openingAmount = Number(opening?._sum.debit || 0) - Number(opening?._sum.credit || 0);
      const received = Number(period?._sum.debit || 0);
      const paid = Number(period?._sum.credit || 0);
      openingBalance += openingAmount; inflows += received; outflows += paid;
      return { bank_account_id: bank.id, account_name: bank.account_name, account_number: bank.account_number, currency: bank.currencies.code, opening_balance: openingAmount, inflows: received, outflows: paid, net_change: received - paid, closing_balance: openingAmount + received - paid };
    });
    res.json({ success: true, data: { accounts, opening_balance: openingBalance, inflows, outflows, net_change: inflows - outflows, closing_balance: openingBalance + inflows - outflows } });
  } catch (error) {
    console.error('Cash Flow Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Journal Report
export const getJournalReport = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id, journal_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const where = { company_id: parseInt(company_id), state: 'posted', ...getEntryFilter(start_date, end_date, period_id) };
    if (journal_id) where.journal_id = parseInt(journal_id);
    const entries = await prisma.journal_entries.findMany({
      where,
      orderBy: [{ entry_date: 'asc' }, { id: 'asc' }],
      include: {
        journals: { select: { id: true, code: true, name: true } },
        journal_items: {
          orderBy: { sequence: 'asc' },
          include: { chart_of_accounts: { select: { code: true, name: true } } },
        },
      },
    });
    const data = entries.map((entry) => ({
      ...entry,
      total_debit: entry.journal_items.reduce((sum, line) => sum + Number(line.debit), 0),
      total_credit: entry.journal_items.reduce((sum, line) => sum + Number(line.credit), 0),
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Journal Report Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Balance Sheet
export const getBalanceSheet = async (req, res) => {
  try {
    const { company_id, as_of_date } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });

    const dateFilter = as_of_date ? new Date(as_of_date) : new Date();

    const where = {
      journal_entries: { 
        company_id: parseInt(company_id), 
        state: 'posted',
        entry_date: { lte: dateFilter }
      },
      chart_of_accounts: { account_types: { internal_group: { in: ['asset', 'liability', 'equity'] } } }
    };

    const result = await prisma.journal_items.groupBy({
      by: ['account_id'],
      where,
      _sum: { debit: true, credit: true }
    });

    const accounts = await prisma.chart_of_accounts.findMany({
      where: { id: { in: result.map(r => r.account_id) } },
      select: { id: true, code: true, name: true, account_types: { select: { internal_group: true, normal_balance: true } } }
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    const assets = [];
    const liabilities = [];
    const equity = [];

    result.forEach(item => {
      const account = accounts.find(a => a.id === item.account_id);
      if (!account) return;

      const debit = parseFloat(item._sum.debit || 0);
      const credit = parseFloat(item._sum.credit || 0);
      const balance = account.account_types.normal_balance === 'credit' ? (credit - debit) : (debit - credit);

      const entry = {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        balance
      };

      if (account.account_types.internal_group === 'asset') {
        totalAssets += balance;
        assets.push(entry);
      } else if (account.account_types.internal_group === 'liability') {
        totalLiabilities += balance;
        liabilities.push(entry);
      } else if (account.account_types.internal_group === 'equity') {
        totalEquity += balance;
        equity.push(entry);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        as_of_date: dateFilter,
        assets: { total: totalAssets, accounts: assets },
        liabilities: { total: totalLiabilities, accounts: liabilities },
        equity: { total: totalEquity, accounts: equity }
      }
    });
  } catch (error) {
    console.error('Balance Sheet Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
