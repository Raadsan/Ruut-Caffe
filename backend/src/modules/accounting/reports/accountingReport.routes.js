import express from 'express';
import {
  getGeneralLedger,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlow,
  getJournalReport
} from './accountingReport.controller.js';
import { protect } from '../../../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/general-ledger', getGeneralLedger);
router.get('/trial-balance', getTrialBalance);
router.get('/profit-and-loss', getProfitAndLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/cash-flow', getCashFlow);
router.get('/journal-report', getJournalReport);

export default router;
