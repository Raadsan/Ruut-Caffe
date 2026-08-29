import { Landmark } from 'lucide-react';
import ConfigurationCrudPage from '@/components/accounting/ConfigurationCrudPage';
import ChartOfAccountsPage from '@/components/accounting/ChartOfAccountsPage';
import FiscalManagementPage from '@/components/accounting/FiscalManagementPage';
import GeneralLedgerPage from '@/components/accounting/GeneralLedgerPage';
import PartnerMasterDataPage from '@/components/shared/PartnerMasterDataPage';
import CustomerInvoicesPage from '@/components/accounting/CustomerInvoicesPage';
import CustomerReceiptsPage from '@/components/accounting/CustomerReceiptsPage';
import CreditNotesPage from '@/components/accounting/CreditNotesPage';
import VendorBillsPage from '@/components/accounting/VendorBillsPage';
import VendorPaymentsPage from '@/components/accounting/VendorPaymentsPage';
import BankingSetupPage from '@/components/accounting/BankingSetupPage';
import CashTransactionsPage from '@/components/accounting/CashTransactionsPage';
import FinancialReportsPage, { type FinancialReportKind } from '@/components/accounting/FinancialReportsPage';
import MenuPage from '@/app/(dashboard)/menus/page';

const CONFIGURATION_SECTIONS = new Set([
  'account-types', 'currencies', 'companies', 'payment-methods',
  'payment-terms', 'taxes', 'product-categories',
]);

const TITLES: Record<string, string> = {
  'account-types': 'Account Types',
  currencies: 'Currencies',
  companies: 'Companies',
  'payment-methods': 'Payment Methods',
  'payment-terms': 'Payment Terms',
  taxes: 'Taxes',
  'product-categories': 'Product Categories',
  configuration: 'Accounting Configuration',
  'chart-of-accounts': 'Chart of Accounts',
  fiscal: 'Fiscal Management',
  'fiscal-years': 'Fiscal Years',
  'fiscal-periods': 'Fiscal Periods',
  ledger: 'General Ledger',
  journals: 'Journals',
  'journal-entries': 'Journal Entries',
  receivables: 'Receivables',
  customers: 'Customers',
  'customer-invoices': 'Customer Invoices',
  'customer-receipts': 'Customer Receipts',
  'credit-notes': 'Credit Notes',
  payables: 'Payables',
  vendors: 'Vendors',
  'vendor-bills': 'Vendor Bills',
  'vendor-payments': 'Vendor Payments',
  'vendor-refunds': 'Vendor Refunds',
  banking: 'Banking',
  'bank-accounts': 'Bank Accounts',
  'cash-transactions': 'Cash Transactions',
  products: 'Products',
  reports: 'Financial Reports',
  'general-ledger': 'General Ledger Report',
  'trial-balance': 'Trial Balance',
  'profit-and-loss': 'Profit & Loss',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow',
  'journal-report': 'Journal Report',
};

export default async function AccountingSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const key = section.at(-1) || 'accounting';
  const title = TITLES[key] || key.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  if (CONFIGURATION_SECTIONS.has(key)) {
    return <ConfigurationCrudPage section={key} />;
  }

  if (key === 'chart-of-accounts') {
    return <ChartOfAccountsPage />;
  }

  if (key === 'fiscal-years' || key === 'fiscal-periods') {
    return <FiscalManagementPage kind={key} />;
  }

  if (key === 'journals' || key === 'journal-entries') {
    return <GeneralLedgerPage kind={key} />;
  }

  if (key === 'customers') {
    return <PartnerMasterDataPage kind="customer" />;
  }

  if (key === 'vendors') {
    return <PartnerMasterDataPage kind="vendor" />;
  }

  if (key === 'customer-invoices') {
    return <CustomerInvoicesPage />;
  }

  if (key === 'customer-receipts') {
    return <CustomerReceiptsPage />;
  }

  if (key === 'credit-notes') {
    return <CreditNotesPage />;
  }

  if (key === 'vendor-bills') {
    return <VendorBillsPage />;
  }

  if (key === 'vendor-payments') {
    return <VendorPaymentsPage />;
  }

  if (key === 'vendor-refunds') {
    return <VendorBillsPage kind="refund" />;
  }

  if (key === 'bank-accounts') {
    return <BankingSetupPage />;
  }

  if (key === 'cash-transactions') {
    return <CashTransactionsPage />;
  }

  if (['general-ledger', 'trial-balance', 'profit-and-loss', 'balance-sheet', 'cash-flow', 'journal-report'].includes(key)) {
    return <FinancialReportsPage kind={key as FinancialReportKind} />;
  }

  if (key === 'products' || key === 'menus') {
    return <MenuPage />;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="rounded-2xl border bg-white p-8 shadow-sm dark:bg-zinc-950">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Landmark className="size-6" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary">Accounting Workspace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          This module is connected to the dynamic Accounting sidebar and its frontend API client. Its full data-management screen can now be implemented independently.
        </p>
      </div>
    </div>
  );
} 
