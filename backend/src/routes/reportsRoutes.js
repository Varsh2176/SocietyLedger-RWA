import { Router } from 'express';
import {
  getIncomeExpenditure,
  getFundStatement,
  getBalanceSheet,
} from '../controllers/reportsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate, enforceSocietyIsolation);

router.get('/income-expenditure', getIncomeExpenditure);
router.get('/fund-statement', getFundStatement);
router.get('/balance-sheet', getBalanceSheet);

export default router;
