import { Router } from 'express';
import {
  getApprovals,
  getApprovalById,
  createApproval,
  decideApproval,
} from '../controllers/approvalsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate, enforceSocietyIsolation);

const approvalActors = ['Society Administrator', 'Treasurer', 'Committee Member'];

router.get('/', getApprovals);
router.get('/:id', getApprovalById);
router.post('/', requireRoles(...approvalActors), createApproval);
router.post('/:id/decision', requireRoles(...approvalActors), decideApproval);

export default router;
