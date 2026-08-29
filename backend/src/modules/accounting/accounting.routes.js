import express from 'express'
import accountTypesRoutes from './configuration/accountTypes/accountType.routes.js'
import currenciesRoutes from './configuration/currencies/currency.routes.js'
import companiesRoutes from './configuration/companies/company.routes.js'
import chartOfAccountsRoutes from './ledger/chartOfAccounts/chartOfAccount.routes.js'
import paymentMethodsRoutes from './configuration/paymentMethods/paymentMethod.routes.js'
import paymentTermsRoutes from './configuration/paymentTerms/paymentTerm.routes.js'
import taxesRoutes from './configuration/taxes/tax.routes.js'
import productCategoriesRoutes from './configuration/productCategories/productCategory.routes.js'
import banksRoutes from './banking/banks/bank.routes.js'
import fiscalYearsRoutes from './ledger/fiscalYears/fiscalYear.routes.js'
import fiscalPeriodsRoutes from './ledger/fiscalPeriods/fiscalPeriod.routes.js'
import journalsRoutes from './ledger/journals/journal.routes.js'
import customersRoutes from '../shared/customers/customer.routes.js'
import vendorsRoutes from '../shared/vendors/vendor.routes.js'
import productsRoutes from './catalog/products/product.routes.js'
import bankAccountsRoutes from './banking/bankAccounts/bankAccount.routes.js'
import journalEntriesRoutes from './ledger/journalEntries/journalEntry.routes.js'
import customerInvoicesRoutes from './receivables/customerInvoices/customerInvoice.routes.js'
import customerReceiptsRoutes from './receivables/customerReceipts/customerReceipt.routes.js'
import creditNotesRoutes from './receivables/creditNotes/creditNote.routes.js'
import vendorBillsRoutes from './payables/vendorBills/vendorBill.routes.js'
import vendorPaymentsRoutes from './payables/vendorPayments/vendorPayment.routes.js'
import reportsRoutes from './reports/accountingReport.routes.js'
import sharedRoutes from './shared/shared.routes.js'
import posOrderAccountingRoutes from './services/posOrderAccounting.routes.js'
import { protect, authorizeWorkspace } from '../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect, authorizeWorkspace('ACCOUNTING'))

router.use('/configuration/account-types', accountTypesRoutes)
router.use('/configuration/currencies', currenciesRoutes)
router.use('/configuration/companies', companiesRoutes)
router.use('/chart-of-accounts', chartOfAccountsRoutes)
router.use('/configuration/payment-methods', paymentMethodsRoutes)
router.use('/configuration/payment-terms', paymentTermsRoutes)
router.use('/configuration/taxes', taxesRoutes)
router.use('/configuration/product-categories', productCategoriesRoutes)
router.use('/banks', banksRoutes)
router.use('/fiscal-years', fiscalYearsRoutes)
router.use('/fiscal-periods', fiscalPeriodsRoutes)
router.use('/journals', journalsRoutes)
router.use('/customers', customersRoutes)
router.use('/vendors', vendorsRoutes)
router.use('/products', productsRoutes)
router.use('/bank-accounts', bankAccountsRoutes)
router.use('/journal-entries', journalEntriesRoutes)
router.use('/customer-invoices', customerInvoicesRoutes)
router.use('/customer-receipts', customerReceiptsRoutes)
router.use('/credit-notes', creditNotesRoutes)
router.use('/vendor-bills', vendorBillsRoutes)
router.use('/vendor-payments', vendorPaymentsRoutes)
router.use('/reports', reportsRoutes)
router.use('/shared', sharedRoutes)
router.use('/pos-orders', posOrderAccountingRoutes)

export default router
