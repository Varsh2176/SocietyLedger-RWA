import { Router } from 'express';
import {
  getFunds,
  getFundById,
  createFund,
  updateFund,
} from '../controllers/fundsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

// All routes require authentication and society isolation
router.use(authenticate, enforceSocietyIsolation);

router.get('/', getFunds);
router.get('/:id', getFundById);
router.post('/', requireRoles('Society Administrator', 'Treasurer'), createFund);
router.patch('/:id', requireRoles('Society Administrator', 'Treasurer'), updateFund);

export default router;
