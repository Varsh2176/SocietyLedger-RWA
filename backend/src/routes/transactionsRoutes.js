import { Router } from 'express';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  reverseTransaction,
} from '../controllers/transactionsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate, enforceSocietyIsolation);

router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/', requireRoles('Society Administrator', 'Treasurer'), createTransaction);
router.post('/:id/reverse', requireRoles('Society Administrator', 'Treasurer'), reverseTransaction);

export default router;
