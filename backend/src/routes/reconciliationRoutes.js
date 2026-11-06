import { Router } from 'express';
import {
  getReconciliations,
  getReconciliationById,
  createReconciliation,
  importStatement,
  matchTransaction,
  unmatchTransaction,
  resolveDiscrepancy,
  finalizeReconciliation,
} from '../controllers/reconciliationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate, enforceSocietyIsolation);

const reconciliationReaders = ['Society Administrator', 'Treasurer', 'Auditor'];

// 1. List reconciliation sessions
router.get(
  '/',
  requireRoles(...reconciliationReaders),
  getReconciliations
);

// 2. View single session workspace
router.get(
  '/:id',
  requireRoles(...reconciliationReaders),
  getReconciliationById
);

// 3. Create new session (Treasurer & Admin)
router.post(
  '/',
  requireRoles('Society Administrator', 'Treasurer'),
  createReconciliation
);

// 4. Import statement rows (CSV / JSON)
router.post(
  '/:id/import-statement',
  requireRoles('Society Administrator', 'Treasurer'),
  importStatement
);

// 5. Match statement row with ledger transaction
router.post(
  '/:id/match',
  requireRoles('Society Administrator', 'Treasurer', 'Auditor'),
  matchTransaction
);

// 6. Unmatch transaction
router.post(
  '/:id/unmatch',
  requireRoles('Society Administrator', 'Treasurer', 'Auditor'),
  unmatchTransaction
);

// 7. Resolve discrepancy with explanation and corrective action
router.post(
  '/:id/discrepancies/:discrepancyId/resolve',
  requireRoles('Society Administrator', 'Treasurer', 'Auditor'),
  resolveDiscrepancy
);

// 8. Finalize reconciliation and lock session
router.post(
  '/:id/finalize',
  requireRoles('Society Administrator', 'Treasurer', 'Auditor'),
  finalizeReconciliation
);

export default router;
